import os
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from nlp_engine import FAQEngine

# Initialize Flask app
app = Flask(
    __name__,
    static_folder="static",
    template_folder="."
)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Initialize NLP FAQ Engine
engine = FAQEngine()

@app.route("/")
def home():
    """Serve the index.html page."""
    # Ensure templates directory is configured and load index.html
    return render_template("index.html")

@app.route("/api/categories", methods=["GET"])
def get_categories():
    """Retrieve all available FAQ categories."""
    categories = engine.get_categories()
    # Add count for each category
    category_data = []
    for cat in categories:
        count = len(engine.get_faqs_by_category(cat))
        category_data.append({
            "name": cat,
            "count": count
        })
    return jsonify({
        "success": True,
        "categories": category_data
    })

@app.route("/api/faqs", methods=["GET"])
def get_faqs():
    """Retrieve FAQs filtered by a specific category."""
    category = request.args.get("category", "")
    if not category:
        return jsonify({
            "success": False,
            "error": "Category parameter is required"
        }), 400
    
    faqs = engine.get_faqs_by_category(category)
    return jsonify({
        "success": True,
        "category": category,
        "count": len(faqs),
        "faqs": faqs
    })

@app.route("/api/search", methods=["GET"])
def search():
    """Perform a similarity search across all FAQs."""
    query = request.args.get("q", "")
    if not query:
        return jsonify({
            "success": True,
            "results": []
        })
    
    limit = request.args.get("limit", 5, type=int)
    results = engine.search_faqs(query, limit=limit)
    return jsonify({
        "success": True,
        "query": query,
        "results": results
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    """Chat endpoint for AI similarity response matching."""
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    
    if not message:
        return jsonify({
            "success": False,
            "reply": "Please send a valid message.",
            "matched_faq": None,
            "confidence": 0.0
        })
    
    # Get match from NLP engine
    # Default threshold is 0.22, let's use it
    matched_faq, score = engine.find_best_match(message, threshold=0.22)
    
    if matched_faq:
        return jsonify({
            "success": True,
            "reply": matched_faq["answer"],
            "matched_faq": {
                "id": matched_faq["id"],
                "question": matched_faq["question"],
                "category": matched_faq["category"]
            },
            "confidence": score
        })
    
    # If no match is found, create a helpful context-aware response
    # Try a search to see if any weak matches exist
    weak_matches = engine.search_faqs(message, limit=3)
    
    reply = "I'm sorry, I couldn't find a direct answer to that. Can you rephrase or try another question?\n\n"
    
    if weak_matches:
        reply += "Here are some topics that might be related:\n"
        for match in weak_matches:
            reply += f"- **{match['faq']['question']}** (Category: {match['faq']['category']})\n"
    else:
        reply += "You can explore the categories listed on the left sidebar to find answers to common questions."
        
    return jsonify({
        "success": False,
        "reply": reply,
        "matched_faq": None,
        "confidence": score,
        "suggestions": [m['faq']['question'] for m in weak_matches] if weak_matches else []
    })

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(current_dir, "static", "css"), exist_ok=True)
    os.makedirs(os.path.join(current_dir, "static", "js"), exist_ok=True)
    
    port = int(os.environ.get("PORT", 5000))
    
    # Check if port is free; otherwise search dynamically for a free port
    import socket
    def get_free_port(start_port):
        p = start_port
        while p < start_port + 100:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("127.0.0.1", p))
                    return p
                except socket.error:
                    p += 1
        return start_port
        
    free_port = get_free_port(port)
    print(f"Starting server on port {free_port}...")
    app.run(host="127.0.0.1", port=free_port, debug=True)

