# SSR AI Pharmaclinic

## Current State

A pharmacy counselling chat app with:
- Motoko backend using a simple keyword-based `generateResponse()` function covering ~15 drug categories
- No real AI -- all responses are static hardcoded strings matched by keyword
- Limited medicine coverage (only common Western drugs)
- React frontend with teal OKLCH design, message bubbles, welcome panel, typing indicator

## Requested Changes (Diff)

### Add
- HTTP outcalls from the Motoko backend to a real AI API (Google Gemini) for intelligent, context-aware pharmaceutical responses covering the entire world pharmacopoeia
- A comprehensive system prompt that makes the AI behave as a licensed pharmacy counselling assistant with global medicine knowledge (all WHO essential medicines, regional medicines from Asia, Africa, Latin America, Europe, Middle East, etc.)
- Session-aware conversation context: pass recent chat history to the AI so it can give contextual follow-up answers
- Support for medicine lookups in any language / any country's brand names
- A medicine search feature on the frontend: a dedicated search bar to look up any medicine by name, brand, or active ingredient
- Medicine info cards showing: drug class, common uses, dosage forms, key warnings
- Quick medicine category chips on the welcome screen (Antibiotics, Pain Relief, Heart, Diabetes, Mental Health, Vitamins, etc.)

### Modify
- Backend `sendMessage`: replace keyword matching with AI HTTP outcall that sends session history + user message to Gemini and returns a rich response
- Backend `generateResponse` function: removed entirely, replaced with AI-powered logic
- Frontend welcome panel: add medicine category quick-access chips and a search input
- Frontend suggestion chips: update to reflect wider global medicine knowledge

### Remove
- Static keyword-matching `generateResponse` function in backend
- Hardcoded response strings

## Implementation Plan

1. Select `http-outcalls` Caffeine component
2. Generate new Motoko backend:
   - Use HTTP outcalls to call Gemini API
   - Build a system prompt defining the AI as a global pharmaceutical counselling assistant
   - Include session history context in each request (last 6 messages)
   - Add `searchMedicine(query: Text)` function for dedicated medicine lookup
   - Keep `sendMessage`, `clearHistory`, `getChatHistory` signatures unchanged
3. Frontend updates:
   - Add medicine category chips to welcome panel (Antibiotics, Pain Relief, Cardiovascular, Diabetes, Mental Health, Vitamins & Supplements, Respiratory, Women's Health, Pediatrics, Tropical Diseases)
   - Update suggestion chips to more global/diverse examples
   - Add a medicine search bar below category chips
   - Show medicine info card when search result comes back
   - Display AI badge in header to signal real AI is powering responses
