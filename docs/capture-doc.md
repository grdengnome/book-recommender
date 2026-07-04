# Original Idea Capture (archival)

*This is the raw, unedited capture doc that everything else in this repo was synthesized from — spec.md, question-bank.md, and eval-set.md are all downstream of this. Kept verbatim, fragments and all, so there's always a way to check "did I actually say that" against the source rather than trusting later summaries.*

---

## How it should work

- Book recommender that uses user input to provide a recommendation
- The main goal of the app is provide AI-generated recommendations based on inputs and user feedback
- The recommendations should be a concise list that pop up in pokemon-card esque way to maximize visual effects
- The cards should be visuals with the cover of the book as the background with a short description intended to potentially engage the user
- If a user wants to learn more about the book the cards to be able to turn over to provide a more detailed description of the book and potential ratings
- Main flow: page opens with a simple interface with a general question or category for a user to select → as the user continues to select preferences, moods, genres, length, etc the AI should continue to refine and refine to provide 3 main suggestions
- A second feature will be a book ranking system that will allow users to choose between two books they've read to rank them
  - This feature will be very similar to the restaurant ranking system in Beli
  - This feature will allow users to keep a running list of their favorite books which should seamlessly allow them to add a new book to their rankings
- A third feature will just be an organization page to keep track of what they've read, want they want to read, etc.
- The suggestions should be creative and dynamic based on how the users answer
- I will want to understand and evaluate the recommendations to ensure the books being suggested are valued and accepted by the user
- The suggestions should also utilize very reputable sources to ensure as many books as possible are being considered

## Design & formatting

- Opening page should instantly be the book recommender
- The opening page design should be very simplistic with "cartoon" or fairy tale accessory details and should mimic book covers and potentially rotate interchangeably
- The theme should be vibrant colors to mimic book imagination and creativity
- The buttons should be visually pleasing and satisfying when clicking
- The buttons should "explode" or pop away like a cloud again to have an immersive or fiction feeling
- All features design should flow seamlessly into one another and carryover a consistent theme
- Each screen should be engaging and visually stimulating while also maintaining a simple interface guiding the users eyes to the most important areas

## Taste & what "good" means

- Real "find me that feeling" examples (e.g. *Gods of New York* → granular NYC texture + moral ambiguity → what else): Books that leave an impression on you.
  - Books that leave an impression on you
  - Books that you are itching to recommend to people
  - Books that wouldn't initially stand out to you as something you might want to read but can't put down
  - Stoner by John Williams
  - The Uncool by Cameron Crowe
  - Project Hail Mary
- What separates a genuinely good recommendation from a lazy/obvious one:
  - For me a lot of the lazy/obvious recommendations come when everyone is recommending it just to recommend it because other people enjoy it
  - Unless it truly is captivating, I almost get turned off when a few books are constantly recommended for a particular genre or category
  - It feels like a surface level recommendation and I like the recommendations that go next level that aren't super mainstream but are just high as quality
  - The recommender should take a wide variety of years, authors, genres, and sources to provide recommendations
  - It shouldn't rely on a single source it should research and combine the research from multiple sources to provide the most applicable suggestions to a user based on the suggestion
  - If more info is required it should continue to prompt the user to provide it
- Hard cases the recommender needs to handle well (the ones that would expose a weak version):
  - This is where I think the recommender needs to be flexible
  - There should be a set number of baseline questions to be asked
  - Based on the user answers, the recommender should automatically recognize if more/less questions need to be asked in order to provide relevant suggestions
  - Ideally there shouldn't be an overwhelming amount of questions
  - If the user doesn't like the recommendations there should be a pivot from the app in a smooth transitional way
    - Potentially asking questions that may clarify the users/needs to get to better recs

## Features

- The questions or prompts shouldn't just be word related prompts or questions asked by the AI
- There should be visuals for users to choose from, colors to pick, creative questions that allow the user to help provide their reading style and interests to the app in unique ways
- This feature should also be engaging for the users so it doesn't feel like the same loop every time
- It should be able to connect to goodreads or other book tracking apps for seamless transition to import book reading lists
- This import function will be important for the book ranking feature
  - It will save users times from having to manually add each book
  - It will also allow the user to get to the ranking asap which is a fun exercise
- There should be a profile feature with account details, preferences, layout selections, etc
- Tabs at the bottom for ease of navigation

## Data & sources

- This will be one of the most valuable/important pieces of the app
- Where do the best recommendations come from
- Good reads, libraries, new york time best seller list, youtube, tiktok, reddit
- I want the sources to be as grand as possible to ensure the same recommendations aren't consistently spit out
- The recommendations should be creative and should be as applicable to the user input as possible

## Worries / risks

- If I wanted to somehow monetize it how would I do it
- How do I exhibit my ability to utilize ai to build a functional app

---

*Everything above is preserved as originally written. Where later documents (spec.md, question-bank.md) resolved a `?`-marked open question or made a judgment call, that resolution lives there — this file intentionally does not get edited to match.*
