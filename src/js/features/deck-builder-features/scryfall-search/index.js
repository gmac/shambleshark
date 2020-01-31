import Feature from '../../feature'
import bus from 'framebus'
import { sections } from '../../constants'
import Drawer from '../../../lib/ui-elements/drawer'
import AddCardElement from '../../../lib/ui-elements/add-card-element'
import {
  flattenEntries,
  isSingletonTypeDeck
} from '../../../lib/deck-parser'
import scryfall from '../../../lib/scryfall'
import {
  EXTERNAL_ARROW
} from '../../../resources/svg'

// TODO
// use singleton mode when in commander deck

class ScryfallSearch extends Feature {
  async run () {
    this.drawer = this.createDrawer()

    document.getElementById('header-search-field').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') {
        return
      }
      e.preventDefault()

      this.onEnter(e.target.value)
    })
  }

  async onEnter (query) {
    this.drawer.open()

    const deckPromise = scryfall.getDeck()
    const searchPromise = scryfall.api.get('cards/search', {
      q: query
    }).catch((e) => {
      // most likely a 404, return no results
      return []
    })

    const [deck, cards] = await Promise.all([deckPromise, searchPromise])

    this.drawer.setHeader(`Scryfall Search - ${cards.total_cards} result${cards.total_cards !== 1 ? 's' : ''} <a style="display:inline-block;width:12px;" href="/search?q=${encodeURI(query)}">${EXTERNAL_ARROW}</a>`)
    this.deck = deck
    this.isSingleton = isSingletonTypeDeck(deck)
    this.cardList = cards
    this.addCards()
    this.drawer.setLoading(false)
  }

  addCards () {
    if (this.cardList.length === 0) {
      this.container.innerHTML = '<div style="text-align:center;margin-top:10px;">No search results.</div>'

      return
    }

    const entries = flattenEntries(this.deck)
    this.cardList.forEach(card => {
      const cardInDeck = entries.find(entry => entry.card_digest && entry.card_digest.oracle_id === card.oracle_id)
      const quantity = cardInDeck ? cardInDeck.count : 0
      const addCardEl = new AddCardElement({
        quantity,
        singleton: this.isSingleton,
        id: card.id,
        name: card.name,
        img: card.getImage(),
        type: card.type_line
      })

      this.container.appendChild(addCardEl.element)
    })
  }

  isReadyToLookupNextBatch (el) {
    if (this._nextInProgress || !this.cardList || !this.cardList.has_more) {
      return false
    }

    return el.scrollTop + el.clientHeight >= el.scrollHeight - 15000
  }

  createDrawer (button) {
    const self = this
    const drawer = new Drawer({
      id: 'scryfall-search-drawer',
      // TODO add scryfall symbol?
      // headerSymbol: EDHREC_SYMBOL,
      header: 'Scryfall Search',
      loadingMessage: 'Loading Scryfall Search',
      onScroll (drawerInstance) {
        if (!self.isReadyToLookupNextBatch(drawerInstance.getScrollableElement())) {
          return
        }

        self._nextInProgress = true

        return self.cardList.next().then(cards => {
          self.cardList = cards
          self.addCards()
          self._nextInProgress = false
        })
      },
      onClose (drawerInstance) {
        self.cardList = null
        // TODO constant
        bus.emit('CLEAN_UP_DECK')

        // reset this in case the error state changes it
        drawerInstance.setLoading(true)
        drawerInstance.resetHeader()
        self.container.innerHTML = ''

        // re-focus the Scryfall Search input
        // for accessibility navigation
        document.getElementById('header-search-field').focus()
      }
    })
    // TODO: the drawer class should probably handle this
    document.getElementById('deckbuilder').appendChild(drawer.element)

    this.container = document.createElement('div')
    drawer.setContent(this.container)

    return drawer
  }
}

ScryfallSearch.metadata = {
  id: 'scryfall-search',
  title: 'Scryfall Search',
  section: sections.DECK_BUILDER,
  description: 'Search for Scryfall cards right inside the deckbuilder! You can save the searches for later too!'
}

ScryfallSearch.settingsDefaults = {
  enabled: true
}

export default ScryfallSearch
