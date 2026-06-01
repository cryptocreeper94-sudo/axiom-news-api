import re

with open('gemini.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_prompt = """You must return a raw JSON object exactly matching this schema (do not wrap in markdown):
{
    "coreEvent": "A purely factual 1-sentence headline of the event.",
    "processTimeline": [
        "Factual event step 1",
        "Factual event step 2",
        "Factual event step 3"
    ],
    "biasScore": 0-100 (integer representing how emotionally charged or biased the original text was. 0 = purely factual, 100 = completely unhinged propaganda),
    "strippedTerms": ["list", "of", "exact", "words", "or", "phrases", "you", "stripped", "from", "the", "raw", "text", "because", "they", "were", "biased"]
}"""

new_prompt = """You must return a raw JSON object exactly matching this schema (do not wrap in markdown):
{
    "coreEvent": "A purely factual 1-sentence headline of the event.",
    "category": "Must be exactly one of: 'Politics', 'Finance', 'Technology', or 'World'",
    "imageKeyword": "A highly specific 1-2 word visual noun related to the event (e.g. 'rocket', 'senate', 'bank', 'protest'). Must be a highly aesthetic noun. Return null if the event is boring.",
    "processTimeline": [
        "Factual event step 1",
        "Factual event step 2",
        "Factual event step 3"
    ],
    "biasScore": 0-100 (integer representing how emotionally charged or biased the original text was. 0 = purely factual, 100 = completely unhinged propaganda),
    "strippedTerms": ["list", "of", "exact", "words", "or", "phrases", "you", "stripped", "from", "the", "raw", "text", "because", "they", "were", "biased"]
}"""

content = content.replace(old_prompt, new_prompt)

with open('gemini.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Gemini patched to return category and imageKeyword!")
