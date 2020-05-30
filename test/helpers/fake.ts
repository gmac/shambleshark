import shortid = require("shortid");

import type { Deck, Card, DeckSections } from "Js/types/deck";
import type { EDHRecSuggestion } from "Js/types/edhrec";

type FakeDeckOptions = Partial<Deck> & {
  primarySections?: DeckSections[];
  secondarySections?: DeckSections[];
};
type FakeCardOptions = Partial<Card> & {
  rawText?: Card["raw_text"];
  cardDigest?: Partial<Card["card_digest"]> | boolean;
};
type FakeEDHRecSuggestionOptions = Partial<EDHRecSuggestion>;

export function makeFakeCard(overrides: FakeCardOptions = {}): Card {
  let cardDigest: Record<string, string> | undefined;
  const defaultCardDigest: Record<string, string> = {
    oracle_id: `oracle-id-${shortid.generate()}`,
    type_line: "type",
  };

  if (overrides.cardDigest !== false) {
    cardDigest = Object.assign({}, defaultCardDigest, overrides.cardDigest);
  }

  return {
    id: overrides.id || "card-in-deck-id",
    raw_text: "rawText" in overrides ? overrides.rawText : "raw text",
    section: overrides.section || "commanders",
    count: "count" in overrides ? overrides.count : 1,
    card_digest: cardDigest,
  };
}

export function makeFakeDeck(overrides: FakeDeckOptions = {}): Deck {
  const primary = overrides.primarySections || ["commanders", "nonlands"];
  const secondary = overrides.secondarySections || ["lands", "maybeboard"];
  const allSections = primary.concat(secondary);
  const entries = overrides.entries || {};

  allSections.forEach((section: DeckSections) => {
    if (!entries[section]) {
      entries[section] = [
        makeFakeCard({
          id: `id-${shortid.generate()}`,
          section,
        }),
      ];
    }
  });

  return {
    id: overrides.id || `deck-id-${shortid.generate()}`,
    sections: {
      primary,
      secondary,
    },
    entries,
  };
}

export function makeFakeEDHRecSuggestion(
  options: FakeEDHRecSuggestionOptions = {}
): EDHRecSuggestion {
  return {
    primary_types: ["Creature"],
    names: ["Fake Name"],
    scryfall_uri: "https://scryfall.com/card/set/id/fake-id",
    images: ["fake-unknown.png"],
    price: 19.99,
    salt: 10,
    score: 99,
    ...options,
  };
}
