import bulmaCSS from 'bulma/css/bulma.min.css'
import bulmaSwitchCSS from 'bulma-switch/dist/css/bulma-switch.min.css'
import optionsCSS from '../css/options.css'

import injectCSS from './lib/inject-css'

import globalFeatures from './features/global-features'
import deckbuilderFeatures from './features/deck-builder-features'
import deckViewFeatures from './features/deck-view-features'

injectCSS(bulmaCSS + bulmaSwitchCSS + optionsCSS)

const features = globalFeatures
  .concat(deckbuilderFeatures)
  .concat(deckViewFeatures)

function setupToggleListeners (element, fn) {
  element.addEventListener('change', fn)
  element.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      element.checked = !element.checked
      fn()
    }
  })
}

function createInputForType (def, inputValue, Feature) {
  switch (def.input) {
    case 'checkbox':
      return createCheckbox(def, inputValue, Feature)
  }
}

function createCheckbox (def, inputValue, Feature) {
  const checkboxContainer = document.createElement('label')
  checkboxContainer.innerHTML = `
    <input type="checkbox" id="${def.id}-checkbox" />
    ${def.label}
  `
  checkboxContainer.classList.add('checkbox')
  const checkbox = checkboxContainer.querySelector('input')
  checkbox.checked = inputValue
  checkbox.addEventListener('change', () => {
    Feature.saveSetting(def.id, checkbox.checked)
  })

  return checkboxContainer
}

const page = document.createElement('div')
page.innerHTML = `
<section class="hero is-primary is-fullheight">
  <div class="hero-body">
    <div id="settings-container" class="container">
      <div class="columns is-5-tablet is-4-desktop is-3-widescreen">
        <div class="column has-text-centered">
          <h1 class="title has-text-centered">Shambleshark</h1>
          <h3 class="subtitle has-text-centered">Unofficial Scryfall Browser Extension</h3>
        </div>
      </div>
      <div class="columns is-5-tablet is-4-desktop is-3-widescreen">
        <div class="column box">
          <form id="settings-form">

            <div id="global">
              <h2 class="title has-text-dark">Global Settings</h2>
            </div>
            <div id="deck-builder">
              <h2 class="title has-text-dark">Deckbuilder Page</h2>
            </div>
            <hr>
            <div id="deck-view">
              <h2 class="title has-text-dark">Deck View Page</h2>
            </div>
            <hr>
          </form>
          <footer class="footer is-paddingless">
            <div class="has-text-centered">
              <p>
                This browser extension is not affiliated nor endorsed by Scryfall LLC.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  </div>
</section>
`

Promise.all(features.map((Feature) => {
  const container = document.createElement('fieldset')
  const data = Feature.metadata
  const section = page.querySelector(`#${data.section}`)
  const enabledSwitchId = `${data.id}-enabled-switch`
  const isFutureFeature = data.futureFeature

  let title = data.title

  if (isFutureFeature) {
    title += ' (Coming Soon)'
  }

  container.className = 'field'

  container.innerHTML = `
    <div>
      <input id="${enabledSwitchId}" type="checkbox" class="switch" aria-label="${title} toggle - ${data.description}">
      <label class="has-text-weight-bold" for="${enabledSwitchId}">${title}</label>
    </div>
    <p class="content feature-description">${data.description}</p>
  `

  if (isFutureFeature) {
    container.setAttribute('disabled', 'disabled')
  }

  section.appendChild(container)
  // construct HTML for additioanl settings

  return Feature.getSettings().then((settings) => {
    const enabledSwitch = container.querySelector('input')

    setupToggleListeners(enabledSwitch, () => {
      if (enabledSwitch.checked) {
        Feature.enable()
      } else {
        Feature.disable()
      }
    })

    if (!isFutureFeature && settings.enabled) {
      enabledSwitch.checked = true
    }

    if (Feature.settingDefinitions.length) {
      container.querySelector('.feature-description').classList.add('has-options')
    }

    Feature.settingDefinitions.forEach(def => {
      const input = createInputForType(def, settings[def.id], Feature)
      input.classList.add('feature-option')

      if (input) {
        container.appendChild(input)
      }
    })

    const disabledOverlay = document.createElement('div')
    disabledOverlay.classList.add('disabled-overlay')
    container.appendChild(disabledOverlay)
  })
})).then(() => {
  document.body.appendChild(page)
})
