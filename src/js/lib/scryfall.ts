import * as bus from "framebus";
import { BUS_EVENTS as events } from "Constants";
import { Deck } from "Js/types/deck";
import ScryfallApi = require("scryfall-client");

const CACHE_TIMEOUT_FOR_DECK_REQUESTS = 2000; // 2 seconds

let getDeckPromise: Promise<Deck> | null;

type CollectionEntry = {
  set?: string;
  collector_number?: string;
};

export const api = new ScryfallApi();

export async function getCollection(ids: CollectionEntry[]) {
  const idBatches = ids.reduce((array: CollectionEntry[][], entry, i) => {
    if (i % 75 !== 0) {
      return array;
    }

    return array.concat(ids.slice(i, i + 75));
  }, []);

  const collectionResults = await Promise.all(
    idBatches.map((identifiers) =>
      api.post("/cards/collection", { identifiers })
    )
  );

  return collectionResults.flat();
}

export function getDeck() {
  if (getDeckPromise) {
    return getDeckPromise;
  }

  getDeckPromise = new Promise((resolve) => {
    bus.emit(events.REQUEST_DECK, resolve);
  });

  setTimeout(() => {
    getDeckPromise = null;
  }, CACHE_TIMEOUT_FOR_DECK_REQUESTS);

  return getDeckPromise;
}

export default {
  api,
  getCollection,
  getDeck,
};
