import json
import os
import re
import nltk
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer

# Set local NLTK data path to keep implementation self-contained
current_dir = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("VERCEL") or not os.access(current_dir, os.W_OK):
    nltk_data_dir = "/tmp/nltk_data"
else:
    nltk_data_dir = os.path.join(current_dir, "nltk_data")

os.makedirs(nltk_data_dir, exist_ok=True)
nltk.data.path.append(nltk_data_dir)

# Download resources locally if not present
for resource in ["tokenizers/punkt", "corpora/stopwords", "corpora/wordnet"]:
    try:
        nltk.data.find(resource)
    except LookupError:
        resource_name = resource.split('/')[-1]
        nltk.download(resource_name, download_dir=nltk_data_dir, quiet=True)

# Initialize NLP components
try:
    stop_words = set(stopwords.words('english'))
except Exception:
    # Fallback in case stopwords failed to load
    stop_words = {"i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "he", "him", "his", "she", "her", "it", "its", "they", "them", "what", "which", "who", "whom", "this", "that", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"}

lemmatizer = WordNetLemmatizer()

def preprocess_text(text):
    if not text:
        return ""
    # Lowercase
    text = text.lower()
    # Retain only words, spaces, and specific symbols useful for tech questions (+, #, ., -)
    text = re.sub(r'[^a-z0-9+#.\s-]', ' ', text)
    
    raw_tokens = text.split()
    cleaned_tokens = []
    
    for token in raw_tokens:
        # Strip trailing dot, hyphen or other punctuation that is not part of the tech name
        token = token.strip('.')
        if token and token not in stop_words:
            try:
                lemma = lemmatizer.lemmatize(token)
            except Exception:
                lemma = token
            cleaned_tokens.append(lemma)
            
    return " ".join(cleaned_tokens)

class FAQEngine:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(current_dir, "faq_database.json")
        self.db_path = db_path
        self.faqs = []
        self.corpus = []
        self.corpus_mapping = []  # Maps each corpus text back to its index in self.faqs
        # Use custom regex token pattern to split precisely on whitespaces
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), token_pattern=r'\S+')
        self.tfidf_matrix = None
        self.load_database()
        self.build_index()

    def load_database(self):
        try:
            with open(self.db_path, 'r', encoding='utf-8') as f:
                self.faqs = json.load(f)
            print(f"Loaded {len(self.faqs)} FAQs from database.")
        except Exception as e:
            print(f"Error loading FAQ database: {e}")
            self.faqs = []

    def build_index(self):
        if not self.faqs:
            print("No FAQs to index.")
            return

        self.corpus = []
        self.corpus_mapping = []

        for idx, faq in enumerate(self.faqs):
            # Index the main question
            prep_q = preprocess_text(faq['question'])
            if prep_q:
                self.corpus.append(prep_q)
                self.corpus_mapping.append(idx)
            
            # Index variations (useful for Romanized Telugu and alternative phrasings)
            for var in faq.get('variations', []):
                prep_var = preprocess_text(var)
                if prep_var:
                    self.corpus.append(prep_var)
                    self.corpus_mapping.append(idx)

        if self.corpus:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus)
            print(f"Built TF-IDF matrix with shape: {self.tfidf_matrix.shape}")
        else:
            print("Corpus is empty. Indexing failed.")

    def find_best_match(self, query, threshold=0.22):
        if not self.faqs or self.tfidf_matrix is None:
            return None, 0.0

        prep_query = preprocess_text(query)
        if not prep_query:
            return None, 0.0

        # Vectorize user query
        query_vec = self.vectorizer.transform([prep_query])
        if query_vec.nnz == 0:
            return None, 0.0

        # Calculate Cosine Similarity
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        best_idx = similarities.argsort()[-1]
        best_score = float(similarities[best_idx])

        if best_score >= threshold:
            faq_idx = self.corpus_mapping[best_idx]
            return self.faqs[faq_idx], best_score
        
        return None, best_score

    def search_faqs(self, query, limit=5):
        if not self.faqs or self.tfidf_matrix is None:
            return []

        prep_query = preprocess_text(query)
        if not prep_query:
            return []

        query_vec = self.vectorizer.transform([prep_query])
        if query_vec.nnz == 0:
            return []

        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        
        # Sort indices by similarity score descending
        sorted_indices = similarities.argsort()[::-1]
        
        results = []
        seen_faq_ids = set()
        
        for idx in sorted_indices:
            score = float(similarities[idx])
            if score <= 0.05:  # Minimum weak match criteria
                break
            faq_idx = self.corpus_mapping[idx]
            faq = self.faqs[faq_idx]
            
            if faq['id'] not in seen_faq_ids:
                results.append({
                    "faq": faq,
                    "score": score
                })
                seen_faq_ids.add(faq['id'])
                
            if len(results) >= limit:
                break
                
        return results

    def get_categories(self):
        categories = sorted(list(set(faq['category'] for faq in self.faqs)))
        return categories

    def get_faqs_by_category(self, category):
        return [faq for faq in self.faqs if faq['category'].lower() == category.lower()]
