// Setup steps for coding agents, served at /agents.md. The docs page's agent
// prompt points agents here. The code samples come from the same helpers as
// the guide.
import {
  DOCS_KEY,
  EXPO_PERMISSIONS,
  IDENTIFY_NEXT,
  reactNativeComponent,
} from './widget-docs'
import {
  DEFAULT_WIDGET_OPTIONS,
  FRAMEWORKS,
  frameworkExample,
} from './widget-snippet'

export const agentSetupPrompt = (appUrl: string) =>
  `Set up the Pulse feedback widget for me by following ${appUrl}/agents.md`

export const widgetAgentsMarkdown = (appUrl: string) => {
  const websiteCode = FRAMEWORKS.filter((item) => item.id !== 'nocode')
    .map(
      (item) =>
        `### ${item.name}\n\n\`\`\`\n${frameworkExample(item.id, appUrl, DOCS_KEY, DEFAULT_WIDGET_OPTIONS)}\n\`\`\``,
    )
    .join('\n\n')

  return `# Setting up Pulse: instructions for coding agents

You are a coding agent, and your user wants the Pulse voice feedback widget in their website or React Native app. Follow these steps in order. Do the code changes yourself. Where a step says the user must do something, ask them and wait.

Pulse adds a "Feedback" button. Customers tap it, record a voice note (or type), and the business reads the transcript in Pulse. The full guide is at ${appUrl}/docs/widget.md.

## 1. Work out the stack

Read \`package.json\` and the project layout. Use the website steps for Next.js, React (Vite), Astro, Vue or Nuxt, or plain HTML. Use the React Native steps for Expo or bare React Native. For WordPress, Webflow or Framer there is no code to change: tell the user to paste the HTML snippet into the site's custom code box, before \`</body>\`.

## 2. Get the widget key

The user must do this: ask them to open ${appUrl}/settings, turn on the website widget, and send you the \`data-key\` value from the install code. It starts with \`pk_\`. Never make one up. The key is public, like a publishable API key, so it can go straight into source code. Below, replace \`${DOCS_KEY}\` with it.

For a website, ask them in the same message to list each site that will show the widget, on the same Settings page: one origin per line, such as \`https://example.com\`, plus \`http://localhost:3000\` (with the real port) to try it locally. The panel won't open on a site that isn't listed, and you can't do this for them. Apps don't need listing.

## 3a. Website

Add the snippet for the stack, once, so it loads on every page. Add it to the existing root layout or entry file; don't replace the file. With the Next.js Pages Router, put the \`<Script>\` in \`pages/_app.tsx\`.

${websiteCode}

If the project sends a Content-Security-Policy, add \`${appUrl}\` to its \`script-src\` and \`frame-src\`. If it sends a Permissions-Policy, allow \`microphone=("${appUrl}")\`, or recording fails. Keep what is already there.

If the app has signed-in users, ask the user whether notes should say who sent them. If yes, call \`identify\` in the browser once the user is known:

\`\`\`js
window.PulseQueue = window.PulseQueue || []
PulseQueue.push(['identify', { id: user.id, email: user.email }])
\`\`\`

In Next.js, do it from a Client Component rendered in the layout:

\`\`\`tsx
${IDENTIFY_NEXT}
\`\`\`

## 3b. React Native

Install the WebView: \`npx expo install react-native-webview\` with Expo, or \`npm install react-native-webview\` and then \`npx pod-install\` without Expo. Use the project's package manager.

Create this component, in the folder the project keeps components in:

\`\`\`tsx
${reactNativeComponent(appUrl)}
\`\`\`

It floats in the bottom corner, like the website button. Ask the user which screens should show it if it isn't obvious, then render it once in each, as the last child of a view that fills the screen:

\`\`\`tsx
<PulseFeedback siteKey="${DOCS_KEY}" />
\`\`\`

If the user wants an existing button, menu item or screen to open the recorder instead, render \`PulseFeedbackSheet\` with \`open\` and \`onClose\` and open it from there, rather than the floating \`PulseFeedback\`. If the user wants the floating button to match their website button, copy its \`data-label\`, \`data-shape\`, \`data-color\`, \`data-position\` and \`data-heading\` into the \`label\`, \`shape\`, \`color\`, \`position\` and \`heading\` props. If the app has signed-in users, pass \`user={{ id, email }}\`, and \`context={{ appVersion }}\` if the version is easy to read.

Recording needs microphone permission. With Expo, merge this into \`app.json\` (or the equivalent keys in \`app.config.*\`), keeping what is there:

\`\`\`json
${EXPO_PERMISSIONS}
\`\`\`

Without Expo, add \`NSMicrophoneUsageDescription\` to \`ios/<App>/Info.plist\`, and \`RECORD_AUDIO\` and \`MODIFY_AUDIO_SETTINGS\` to \`android/app/src/main/AndroidManifest.xml\`. Skip any already present.

A new native build is needed for the permission to take effect; an over-the-air update can't add it. Expo Go already has it, so the user can try the widget there first. Tell the user that making a new key or turning the widget off in Settings breaks the widget in app versions already released.

## 4. Check it

Website: start the dev server and open a page. A "Feedback" button should sit in the bottom-right corner and open a recorder. If the panel is blank, the site isn't listed in Settings yet.

React Native: build or start the app, tap the button and check the recorder opens.

Ask the user to send one test note and look for it at ${appUrl}/dashboard. Each note spends one pulse.

## 5. Report back

Tell the user which files you changed, and list the steps only they can do: for a website, listing their sites in Settings; for an app, a new native build for the microphone permission.
`
}
