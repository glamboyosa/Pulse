/*
 * Pulse voice feedback widget. Full guide: https://www.pulseapp.click/docs/widget
 *
 *   <script src="https://www.pulseapp.click/widget.js" data-key="pk_..." async></script>
 *
 * Optional attributes:
 *   data-label     button text (default "Feedback")
 *   data-shape     "pill" (default), "square", "circle" (icon only) or "bubble"
 *   data-color     any CSS colour, or "auto" to contrast with the page (default)
 *   data-position  "right" (default) or "left"
 *   data-heading   the panel's title (default: your question in Pulse settings)
 *
 * API. Calls made before this script loads can be queued:
 *   window.PulseQueue = window.PulseQueue || []
 *   PulseQueue.push(['identify', { id: '42' }])
 * Once loaded (each call replaces earlier values):
 *   Pulse.identify({ id, email })     who is leaving feedback (unverified)
 *   Pulse.setContext({ appVersion, ...custom })
 *   Pulse.open(), Pulse.close()
 *
 * The recorder runs in an iframe served by Pulse, so this page's scripts and
 * styles can't reach it. Only the page's path (no query string or fragment),
 * its title, the referring site, the browser and what you pass to
 * identify/setContext are sent. A strict Content-Security-Policy needs
 * pulseapp.click in script-src and frame-src, and a Permissions-Policy must
 * allow microphone=("https://www.pulseapp.click").
 */
;(function () {
  if (window.Pulse && window.Pulse.__loaded) return
  var script =
    document.currentScript ||
    document.querySelector('script[src$="/widget.js"][data-key]')
  if (!script) return
  var key = script.getAttribute('data-key')
  if (!key) return

  var option = function (name) {
    return (script.getAttribute('data-' + name) || '').trim()
  }
  var pulseOrigin = new URL(script.src, location.href).origin
  var label = option('label').slice(0, 40) || 'Feedback'
  var shape = /^(pill|square|circle|bubble)$/.test(option('shape'))
    ? option('shape')
    : 'pill'
  var side = option('position') === 'left' ? 'left' : 'right'
  var colorOption = option('color')
  var heading = option('heading').slice(0, 120)
  var user = {}
  var extra = {}
  var panel = null
  var frame = null

  var dark = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

  /** Black or white, whichever reads better on the given colour. */
  var textOn = function (color) {
    var probe = document.createElement('span')
    probe.style.color = color
    document.body.appendChild(probe)
    var rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]
    probe.remove()
    var luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
    return luminance > 0.6 ? '#111111' : '#ffffff'
  }

  var auto = !colorOption || colorOption === 'auto'
  var canvas = null

  // Sites often have their own theme switch, so look at the colour behind the
  // button rather than the device setting. Each background from there up to
  // <html> is blended on a 1×1 canvas, which also turns oklch() and P3 into
  // plain RGB. Underneath is the browser's own canvas: white, unless the site
  // opts into dark with color-scheme and the device is in dark mode.
  var pageIsDark = function () {
    var rect = button.isConnected ? button.getBoundingClientRect() : null
    var x = rect
      ? rect.left + rect.width / 2
      : side === 'right'
        ? window.innerWidth - 40
        : 40
    var y = rect ? rect.top + rect.height / 2 : window.innerHeight - 40
    var under = document.elementsFromPoint
      ? document.elementsFromPoint(x, y)
      : []
    var start = document.body
    for (var i = 0; i < under.length; i++) {
      if (!button.contains(under[i]) && !(panel && panel.contains(under[i]))) {
        start = under[i]
        break
      }
    }
    // Only page-wide backgrounds count: a dark hero, card or banner that
    // happens to sit in the corner is not the page's theme.
    var pageHeight = document.documentElement.scrollHeight * 0.9
    var layers = []
    for (var el = start; el; el = el.parentElement) {
      var pageWide =
        el === document.body ||
        el === document.documentElement ||
        (el.offsetWidth >= window.innerWidth * 0.9 &&
          el.offsetHeight >= pageHeight)
      if (pageWide) layers.push(getComputedStyle(el).backgroundColor)
    }
    canvas = canvas || document.createElement('canvas')
    canvas.width = canvas.height = 1
    var pen = canvas.getContext('2d', { willReadFrequently: true })
    var meta = document.querySelector('meta[name="color-scheme"]')
    var scheme =
      getComputedStyle(document.documentElement).colorScheme +
      ' ' +
      (meta ? meta.content : '')
    var darkCanvas =
      /dark/.test(scheme) && (!/light/.test(scheme) || (dark && dark.matches))
    pen.fillStyle = darkCanvas ? '#121212' : '#ffffff'
    pen.fillRect(0, 0, 1, 1)
    for (var j = layers.length - 1; j >= 0; j--) {
      // A colour the canvas can't parse is ignored and paints nothing.
      pen.fillStyle = 'transparent'
      pen.fillStyle = layers[j]
      pen.fillRect(0, 0, 1, 1)
    }
    var pixel = pen.getImageData(0, 0, 1, 1).data
    return (0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2]) / 255 < 0.5
  }

  var colors = function () {
    if (auto) {
      return pageIsDark()
        ? { fill: '#ffffff', text: '#111111', edge: '#ffffff' }
        : { fill: '#111111', text: '#ffffff', edge: '#111111' }
    }
    return { fill: colorOption, text: textOn(colorOption), edge: '#111111' }
  }

  // Host pages style buttons and divs too; reset what would leak in.
  var reset =
    'margin:0;box-sizing:border-box;text-transform:none;letter-spacing:normal;' +
    'opacity:1;transform:none;float:none;'

  var micIcon =
    '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/>' +
    '<path d="M12 17v4"/></svg>'

  var shapeStyle = {
    pill: 'padding:14px 20px;border-radius:999px;',
    square: 'padding:14px 18px;border-radius:6px;',
    circle:
      'width:56px;height:56px;padding:0;border-radius:999px;' +
      'display:flex;align-items:center;justify-content:center;',
    // A speech bubble whose tail points at the corner of the screen.
    bubble:
      'padding:14px 20px;border-radius:' +
      (side === 'right' ? '20px 20px 4px 20px;' : '20px 20px 20px 4px;'),
  }

  var button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('data-turbo-temporary', '')
  button.setAttribute('aria-haspopup', 'dialog')
  button.setAttribute('aria-expanded', 'false')
  if (shape === 'circle') {
    button.innerHTML = micIcon
    button.setAttribute('aria-label', label)
  } else {
    button.textContent = label
  }

  var painted = ''
  var paint = function () {
    var c = colors()
    var css =
      reset +
      'position:fixed;bottom:20px;top:auto;' +
      side +
      ':20px;z-index:2147483000;width:auto;height:auto;min-height:44px;' +
      shapeStyle[shape] +
      'border:2px solid ' +
      c.edge +
      ';background:' +
      c.fill +
      ';color:' +
      c.text +
      ';font:700 15px/1 system-ui,sans-serif;' +
      'box-shadow:3px 3px 0 ' +
      (c.edge === '#ffffff' ? 'rgba(255,255,255,.35)' : '#111') +
      ';cursor:pointer'
    if (css === painted) return
    button.style.cssText = css
    painted = css
  }

  var queued = false
  var repaint = function () {
    if (queued) return
    queued = true
    requestAnimationFrame(function () {
      queued = false
      paint()
    })
  }

  // With auto colours, repaint when the site switches theme on <html> or
  // <body>, when a background transition ends, and once late stylesheets load.
  var themeWatcher = new MutationObserver(repaint)
  var themeAttributes = {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme', 'data-mode'],
  }
  var watchTheme = function () {
    if (!auto) return
    themeWatcher.observe(document.documentElement, themeAttributes)
    themeWatcher.observe(document.body, themeAttributes)
  }
  if (auto) {
    if (dark && dark.addEventListener) dark.addEventListener('change', repaint)
    window.addEventListener('load', repaint)
    document.addEventListener(
      'transitionend',
      function (event) {
        if (/^background/.test(event.propertyName)) repaint()
      },
      true,
    )
  }

  var text = function (value) {
    if (value === undefined || value === null) return undefined
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  var referrerOrigin = function () {
    try {
      return document.referrer ? new URL(document.referrer).origin : undefined
    } catch (error) {
      return undefined
    }
  }

  var context = function () {
    var custom = {}
    Object.keys(extra).forEach(function (name) {
      if (name !== 'appVersion') custom[name] = text(extra[name])
    })
    return {
      // Only the path: query strings and fragments often hold tokens.
      page: location.origin + location.pathname,
      title: document.title,
      referrer: referrerOrigin(),
      browser: navigator.userAgent,
      screen: screen.width + 'x' + screen.height,
      language: navigator.language,
      appVersion: text(extra.appVersion),
      userId: text(user.id),
      userEmail: text(user.email),
      custom: custom,
    }
  }

  var sendContext = function () {
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        { type: 'pulse:context', context: context() },
        pulseOrigin,
      )
    }
  }

  // Single-page apps change the page without reloading: keep an open panel's
  // page up to date when the route changes.
  ;['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name]
    history[name] = function () {
      var result = original.apply(this, arguments)
      setTimeout(sendContext, 0)
      return result
    }
  })
  window.addEventListener('popstate', sendContext)

  var build = function () {
    panel = document.createElement('div')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('data-turbo-temporary', '')
    panel.setAttribute('aria-label', heading || label)
    var narrow = window.innerWidth < 480
    panel.style.cssText =
      reset +
      'position:fixed;z-index:2147483001;background:#fff;color:#111;' +
      'border:2px solid #111;box-shadow:4px 4px 0 #111;display:block;' +
      (narrow
        ? 'left:8px;right:8px;bottom:8px;top:auto;height:calc(100vh - 16px);' +
          'height:min(620px,calc(100dvh - 16px))'
        : 'bottom:84px;top:auto;' +
          side +
          ':20px;width:380px;height:calc(100vh - 104px);' +
          'height:min(620px,calc(100vh - 104px))')

    var close = document.createElement('button')
    close.type = 'button'
    close.setAttribute('aria-label', 'Close')
    close.textContent = '×'
    close.style.cssText =
      reset +
      'position:absolute;top:6px;right:8px;left:auto;bottom:auto;z-index:1;' +
      'width:44px;height:44px;padding:0;border:0;background:transparent;' +
      'color:#111;font:700 24px/1 system-ui,sans-serif;cursor:pointer'
    close.addEventListener('click', function () {
      api.close()
    })

    frame = document.createElement('iframe')
    frame.src =
      pulseOrigin +
      '/embed/' +
      encodeURIComponent(key) +
      (heading ? '?heading=' + encodeURIComponent(heading) : '')
    frame.title = heading || label
    frame.setAttribute('allow', 'microphone')
    frame.style.cssText =
      reset + 'width:100%;height:100%;border:0;display:block'

    panel.appendChild(close)
    panel.appendChild(frame)
    document.body.appendChild(panel)
    frame.focus()
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== pulseOrigin || !frame) return
    if (event.source !== frame.contentWindow) return
    var type = event.data && event.data.type
    if (type === 'pulse:close') api.close()
    if (type === 'pulse:ready') sendContext()
  })

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && panel && !event.defaultPrevented) {
      api.close()
    }
  })

  var api = {
    __loaded: true,
    open: function () {
      if (!panel) build()
      button.setAttribute('aria-expanded', 'true')
    },
    // Closing removes the panel, so a recording in progress stops and the
    // microphone is released. The next open starts fresh.
    close: function () {
      if (!panel) return
      panel.remove()
      panel = null
      frame = null
      button.setAttribute('aria-expanded', 'false')
      button.focus()
    },
    identify: function (who) {
      user = who || {}
      sendContext()
    },
    setContext: function (values) {
      extra = values || {}
      sendContext()
    },
  }

  button.addEventListener('click', function () {
    if (panel) api.close()
    else api.open()
  })

  window.Pulse = api
  var run = function (call) {
    if (call && typeof api[call[0]] === 'function') api[call[0]](call[1])
  }

  var mount = function () {
    paint()
    watchTheme()
    document.body.appendChild(button)
    // The first paint guessed the corner; now read what is behind the button.
    repaint()
    // Some routers (Astro view transitions, Turbo) replace <body>: put the
    // button back on the new one. A panel left on the old body is gone.
    new MutationObserver(function () {
      if (button.isConnected || !document.body) return
      if (panel && !panel.isConnected) panel = frame = null
      button.setAttribute('aria-expanded', String(!!panel))
      document.body.appendChild(button)
      watchTheme()
      repaint()
    }).observe(document.documentElement, { childList: true })
    // Run calls queued before this script loaded, then accept new ones directly.
    var queue = Array.isArray(window.PulseQueue) ? window.PulseQueue : []
    window.PulseQueue = { push: run }
    queue.forEach(run)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
