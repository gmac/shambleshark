import Feature from 'Feature'
import CardTooltip from 'Ui/card-tooltip'
import mutation from 'Lib/mutation'
import scryfall from 'Lib/scryfall'
import deckParser from 'Lib/deck-parser'
import {
  sortByAttribute
} from 'Lib/sort'
import createElement from 'Lib/create-element'
import {
  FEATURE_IDS as ids,
  FEATURE_SECTIONS as sections,
  SPINNER_GIF
} from 'Constants'

import './index.css'

class TokenList extends Feature {
  constructor () {
    super()

    this.tooltip = new CardTooltip({
      onMouseover: (el) => {
        const img = el.getAttribute('data-scryfall-image')

        this.tooltip.setImage(img)
      }
    })
  }

  async run () {
    mutation.ready('.sidebar', async (container) => {
      this.createUI(container)

      const tokens = await this.generateTokenCollection()

      this.addToUI(tokens)
    })
  }

  createUI (container) {
    const section = createElement(`<div>
      <p class="deck-details-subtitle token-list-title"><strong>Tokens</strong></p>
      <img src="${SPINNER_GIF}" class="token-list-loading modal-dialog-spinner" aria-hidden="true">
      <ul class="token-list-container deck-details-description"></ul>
    </div>`).firstChild
    section.classList.add('sidebar-toolbox')

    this.tokenListContainer = section.querySelector('.token-list-container')
    this.spinner = section.querySelector('.token-list-loading')

    container.appendChild(section)
  }

  addToUI (tokens) {
    this.spinner.classList.add('hidden')

    if (tokens.length === 0) {
      this.tokenListContainer.appendChild(createElement('<li>No tokens detected.</li>'))

      return
    }

    tokens.forEach(token => {
      const el = createElement(`
        <li data-scryfall-image="${token.getImage()}">
          <a href="${token.scryfall_uri}">${token.name}</a>
        </li>
      `).firstChild

      this.tooltip.addElement(el)
      this.tokenListContainer.appendChild(el)
    })
  }

  findByScryfallId (id) {
    return scryfall.api.get(`/cards/${id}`)
  }

  async fetchStoredData (deck) {
    let storedData = await TokenList.getData(deck.id)

    if (!storedData) {
      storedData = {}
    }
    if (!storedData.entries) {
      storedData.entries = {}
    }

    return storedData
  }

  async generateTokenCollection () {
    this.needsUpdate = false

    const deck = await scryfall.getDeck()
    const entries = deckParser.flattenEntries(deck)

    this.storedData = await this.fetchStoredData(deck)

    const tokenCollection = await this.lookupTokens(entries)

    if (this.needsUpdate) {
      TokenList.saveData(deck.id, this.storedData)
    }

    return this.flattenTokenCollection(tokenCollection)
  }

  lookupTokens (entries) {
    const lookupPromises = []

    entries.forEach(({
      id,
      card_digest: cardDigest
    }) => {
      this.storedData.entries[id] = this.storedData.entries[id] || {}

      const entry = this.storedData.entries[id]
      const tokens = entry.tokens

      if (tokens) {
        lookupPromises.push(Promise.all(tokens.map(token => this.findByScryfallId(token))))

        return
      }

      if (!cardDigest) {
        return
      }

      this.needsUpdate = true

      lookupPromises.push(
        this.findByScryfallId(cardDigest.id)
          .then(card => {
            if (card.all_parts) {
              return card.getTokens()
            }
          }).then(tokens => {
            tokens = tokens || []
            entry.tokens = tokens.map(token => token.id)

            return tokens
          }).catch(e => {
            console.error(e)

            return []
          })
      )
    })

    return Promise.all(lookupPromises)
  }

  flattenTokenCollection (tokenCollection) {
    const flattenedTokens = tokenCollection.flat().reduce((tokens, token) => {
      if (!tokens.find(t => t.oracle_id === token.oracle_id)) {
        tokens.push(token)
      }

      return tokens
    }, [])

    flattenedTokens.sort(sortByAttribute({
      attributes: ['name']
    }))

    return flattenedTokens
  }
}

TokenList.metadata = {
  id: ids.TokenList,
  title: 'Token List',
  section: sections.DECK_VIEW,
  description: 'List tokens created by cards in the deck.'
}
TokenList.settingsDefaults = {
  enabled: true
}

export default TokenList
