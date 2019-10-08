import bus from 'framebus'
import mutation from '../../lib/mutation'
import Modal from '../../lib/modal'
import scryfall from '../../lib/scryfall'
import deckParser from '../../lib/deck-parser'

const PLUS_SYMBOL = `<svg aria-hidden="true" focusable="false" class="svg-plus-symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path fill="#FFF" d="M15 0c-8.284 0-15 6.716-15 15s6.716 15 15 15 15-6.716 15-15-6.716-15-15-15zm0 28c-7.18 0-13-5.82-13-13s5.82-13 13-13 13 5.82 13 13-5.82 13-13 13zm1-22h-2v8h-8v2h8v8h2v-8h8v-2h-8v-8z"></path></svg>`
const CHECK_SYMBOL = `<svg aria-hidden="true" focusable="false" class="svg-check-symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M413.505 91.951L133.49 371.966l-98.995-98.995c-4.686-4.686-12.284-4.686-16.971 0L6.211 284.284c-4.686 4.686-4.686 12.284 0 16.971l118.794 118.794c4.686 4.686 12.284 4.686 16.971 0l299.813-299.813c4.686-4.686 4.686-12.284 0-16.971l-11.314-11.314c-4.686-4.686-12.284-4.686-16.97 0z" fill="#FFF"></path></svg>`
const TYPE_ORDER = [
  'creature',
  'instant',
  'sorcery',
  'artifact',
  'enchantment',
  'planeswalker',
  'land'
]
const TYPES_WITH_IRREGULAR_PLURALS = {
  Sorcery: 'Sorceries'
}

export default async function makeEDHRecButton () {
  addEDHRecIframe()

  const modalTitle = 'EDHRec Suggestions'
  const modal = new Modal({
    id: 'edhrec-modal',
    header: modalTitle,
    onClose (modalInstance) {
      // reset this in case the error state changes it
      modalInstance.setTitle(modalTitle)
      bus.emit('CLEAN_UP_DECK')
      modalInstance.setLoading(true)
    }
  })
  document.getElementById('deckbuilder').appendChild(modal.element)

  const button = document.createElement('button')

  button.id = 'edhrec-suggestions'
  button.classList.add('button-n', 'tiny')
  button.innerText = 'EDHRec Suggestions'
  button.setAttribute('disabled', true)

  button.addEventListener('click', (e) => {
    e.preventDefault()

    modal.open()

    scryfall.getDeck().then((deck) => {
      const commanders = deck.entries.commanders.reduce((all, card) => {
        if (!card.card_digest) {
          return all
        }

        all.push(card.card_digest.name)

        return all
      }, [])

      const cardsInDeck = Object.keys(deck.entries).reduce((all, type) => {
        if (type === 'commanders') {
          return all
        }

        deck.entries[type].forEach((card) => {
          if (!card.card_digest) {
            return all
          }
          all.push(`${card.count} ${card.card_digest.name}`)
        })

        return all
      }, [])

      bus.emit('REQUEST_EDHREC_RECOMENDATIONS', {
        commanders,
        cards: cardsInDeck
      }, function ([err, result]) {
        if (err) {
          createErrorModalState(modal, err)
          return
        }

        const recomendations = formatEDHRecSuggestions(result.inRecs)
        // TODO ENHANCEMENT: handle cuts
        // const cuts = formatEDHRecSuggestions(result.outRecs)

        const container = document.createElement('div')
        const sections = {}
        container.id = 'edhrec-card-suggestions'
        container.style.textAlign = 'center'
        container.style.overflowY = 'scroll'
        container.style.height = '500px'
        container.style.width = '100%'

        Object.values(recomendations).forEach(card => {
          const sectionId = card.type.toLowerCase()
          let section = sections[sectionId]
          if (!section) {
            section = sections[sectionId] = {}
            section.name = card.type
            section.element = document.createElement('div')
            section.element.id = `edhrec-suggestion-${sectionId}`
            section.element.classList.add('edhrec-suggestions-container')

            const sectionTitle = TYPES_WITH_IRREGULAR_PLURALS[section.name] || `${section.name}s`

            section.element.innerHTML = `
              <h3 style="font-size:20px;border-bottom: 1px solid #E0DEE3;padding:15px 0 5px;">${sectionTitle}</h3>
              <div class="edhrec-suggestions"></div>
              `
            section.cards = []
          }

          const cardElement = card.element = document.createElement('div')

          cardElement.classList.add('edhrec-suggestion-card-container')
          let cardAlreadyInDeck = false

          cardElement.innerHTML = `
            <img src="${card.img}" alt="${card.name}" />
            <div class="edhrec-suggestion-overlay">
            ${PLUS_SYMBOL}
            </div>
            `

          const overlay = cardElement.querySelector('.edhrec-suggestion-overlay')

          cardElement.addEventListener('click', function () {
            cardAlreadyInDeck = !cardAlreadyInDeck

            if (cardAlreadyInDeck) {
              scryfall.api.get(`/cards/${card.set}/${card.collectorNumber}`).then((cardFromScryfall) => {
                bus.emit('ADD_CARD_TO_DECK', {
                  cardName: cardFromScryfall.name,
                  cardId: cardFromScryfall.id,
                  isLand: cardFromScryfall.type_line.toLowerCase().indexOf('land') > -1
                })

                cardElement.classList.add('in-deck')
                overlay.innerHTML = CHECK_SYMBOL
              }).catch(err => createErrorModalState(modal, err))
            } else {
              bus.emit('REMOVE_CARD_FROM_DECK', {
                cardName: card.name
              })
              cardElement.classList.remove('in-deck')
              overlay.innerHTML = PLUS_SYMBOL
            }
          })

          section.cards.push(card)
        })

        TYPE_ORDER.forEach(function (type) {
          const section = sections[type]

          if (!section) {
            return
          }

          const suggestions = section.element.querySelector('.edhrec-suggestions')

          section.cards.forEach(card => {
            suggestions.appendChild(card.element)
          })
          container.appendChild(section.element)
        })

        modal.setContent(container)
        modal.setLoading(false)
      })
    })
  })

  const initialDeck = await scryfall.getDeck()

  let commanders = initialDeck.entries.commanders.reduce((all, card) => {
    if (!card.card_digest) {
      return all
    }

    all.push(card.card_digest.name)

    return all
  }, []).sort()

  await setDisabledState(button, commanders)

  mutation.change('.deckbuilder-editor-inner .deckbuilder-column .deckbuilder-section', async (el) => {
    const title = el.querySelector('.deckbuilder-section-title')

    if (title.innerHTML.toLowerCase().indexOf('commander') === -1) {
      // only run mutation on commander column
      return
    }

    const commanderList = Array.from(el.querySelectorAll('ul .deckbuilder-entry')).reduce((all, entry) => {
      // if the select options have more than 2 disabled, this
      // indicates that the card lookup has not completed, so
      // we ignore this value
      const cardLookupNotComplete = entry.querySelectorAll('.deckbuilder-entry-menu-select option[disabled]').length > 2

      if (cardLookupNotComplete) {
        return all
      }

      const input = entry.querySelector('.deckbuilder-entry-input')
      const parts = input.value.trim().match(/^(\d+ )(.*)/)
      if (!parts) {
        return all
      }
      const name = parts[2]

      all.push(name)

      return all
    }, [])
    commanderList.sort()

    // hack to determine if the arrays are equal
    if (commanderList.join('|') !== commanders.join('|')) {
      commanders = commanderList
      await setDisabledState(button, commanders)
    }
  })

  return button
}

async function setDisabledState (button, commanders) {
  const allLegal = await deckParser.hasLegalCommanders(commanders)

  if (allLegal) {
    button.removeAttribute('disabled')
  } else {
    button.setAttribute('disabled', 'disabled')
  }
}

function addEDHRecIframe () {
  const iframe = document.createElement('iframe')
  // does not matter where on edhrec we open the page
  // just need to be on the edhrec domain to access
  // the recs JSON endpoint
  iframe.src = 'https://edhrec.com/404'
  iframe.id = 'edhrec-suggestions-iframe'
  iframe.style.width = '0px'
  iframe.style.height = '0px'
  iframe.style.opacity = 0

  document.body.appendChild(iframe)
}

function formatEDHRecSuggestions (list) {
  return list.reduce((all, rec) => {
    const type = rec.primary_types[0]
    const name = rec.names.join(' // ')
    const scryfallParts = rec.scryfall_uri.split('/card/')[1].split('/')

    all[name] = {
      name,
      type,
      set: scryfallParts[0],
      collectorNumber: scryfallParts[1],
      img: rec.images[0],
      price: rec.price,
      salt: rec.salt,
      score: rec.score
    }

    return all
  }, {})
}

function createErrorModalState (modal, err) {
  modal.setTitle('Something went wrong')

  const container = document.createElement('div')

  if (err.errors) {
    const errorList = document.createElement('ul')
    err.errors.forEach(errorMessage => {
      const errorElement = document.createElement('li')
      errorElement.innerHTML = errorMessage
      errorList.appendChild(errorElement)
    })

    container.appendChild(errorList)
  } else {
    container.innerHTML = `
      <p>An unknown error occurred:</p>
      <pre><code>${err.toString()}</code></pre>
    `
  }

  modal.setContent(container)
  modal.setLoading(false)
}
