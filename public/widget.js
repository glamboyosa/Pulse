/*
 * Pulse voice feedback widget.
 *
 *   <script src="https://www.pulseapp.click/widget.js" data-key="pk_..." async></script>
 *
 * Optional attributes: data-label (button text), data-position ("left" or
 * "right"), data-color (button colour).
 *
 * Optional API, available once this script has loaded (for example inside
 * window.addEventListener('load', ...)). Each call replaces earlier values.
 *   Pulse.identify({ id, email })     who is leaving feedback (unverified)
 *   Pulse.setContext({ appVersion, ...custom })
 *   Pulse.open(), Pulse.close()
 *
 * The recorder runs in an iframe served by Pulse, so this page's scripts and
 * styles can't reach it. Only the page's path (no query string or fragment),
 * its title, the referring site, the browser and what you pass to
 * identify/setContext are sent. A strict Content-Security-Policy needs
 * pulseapp.click in script-src and frame-src.
 */
;(function () {
  if (window.Pulse && window.Pulse.__loaded) return
  var script =
    document.currentScript ||
    document.querySelector('script[src$="/widget.js"][data-key]')
  if (!script) return
  var key = script.getAttribute('data-key')
  if (!key) return

  var pulseOrigin = new URL(script.src, location.href).origin
  var label = script.getAttribute('data-label') || 'Feedback'
  var side = script.getAttribute('data-position') === 'left' ? 'left' : 'right'
  var color = script.getAttribute('data-color') || '#111111'
  var user = {}
  var extra = {}
  var panel = null
  var frame = null

  // Host pages style buttons and divs too; reset what would leak in.
  var reset =
    'margin:0;box-sizing:border-box;text-transform:none;letter-spacing:normal;' +
    'opacity:1;transform:none;float:none;'

  var button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.setAttribute('aria-haspopup', 'dialog')
  button.setAttribute('aria-expanded', 'false')
  button.style.cssText =
    reset +
    'position:fixed;bottom:20px;top:auto;' +
    side +
    ':20px;z-index:2147483000;width:auto;height:auto;' +
    'padding:14px 20px;min-height:44px;border:2px solid #111;border-radius:999px;' +
    'background:' +
    color +
    ';color:#fff;font:700 15px/1 system-ui,sans-serif;' +
    'box-shadow:3px 3px 0 #111;cursor:pointer'

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

  var build = function () {
    panel = document.createElement('div')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Leave feedback')
    var narrow = window.innerWidth < 480
    panel.style.cssText =
      reset +
      'position:fixed;z-index:2147483001;background:#fff;color:#111;' +
      'border:2px solid #111;box-shadow:4px 4px 0 #111;display:block;' +
      (narrow
        ? 'left:8px;right:8px;bottom:8px;top:auto;height:calc(100vh - 16px);' +
          'height:min(620px,calc(100dvh - 16px))'
        : 'bottom:80px;top:auto;' +
          side +
          ':20px;width:380px;height:calc(100vh - 100px);' +
          'height:min(620px,calc(100vh - 100px))')

    var close = document.createElement('button')
    close.type = 'button'
    close.setAttribute('aria-label', 'Close feedback')
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
    frame.src = pulseOrigin + '/embed/' + encodeURIComponent(key)
    frame.title = 'Leave feedback'
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
  var mount = function () {
    document.body.appendChild(button)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
