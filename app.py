import os
import sqlite3
import requests
from flask import Flask, render_template, request, jsonify
from groq import Groq

app = Flask(__name__)
DB_FILE = "pantry.db"

# Initialize the Groq client using an environment variable
# (You will paste your secret GROQ_API_KEY securely inside the Render dashboard)
# Create an explicit custom http client wrapper to completely ignore the hidden proxy bug
import httpx
custom_http_client = httpx.Client(proxies=None) if hasattr(httpx, 'Client') else None

groq_client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
    http_client=custom_http_client
)


def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS pantry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT,
                item_name TEXT,
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/scan', methods=['POST'])
def scan_barcode():
    data = request.json
    barcode = data.get('barcode')
    
    if not barcode:
        return jsonify({"error": "No barcode provided"}), 400

    # Query the free Open Food Facts API
    url = f"https://openfoodfacts.org{barcode}.json"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            res_data = response.json()
            if res_data.get('status') == 1:
                product = res_data.get('product', {})
                item_name = product.get('product_name', 'Unknown Item')
                
                # Save automatically to SQLite database
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute("INSERT INTO pantry (barcode, item_name) VALUES (?, ?)", (barcode, item_name))
                return jsonify({"status": "success", "item_name": item_name})
    except Exception as e:
        return jsonify({"error": "Failed to look up barcode"}), 500

    return jsonify({"error": "Product not found in database"}), 404

@app.route('/api/pantry', methods=['GET', 'POST', 'DELETE'])
def manage_pantry():
    if request.method == 'GET':
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, item_name, barcode FROM pantry ORDER BY date_added DESC")
            items = [{"id": row[0], "item_name": row[1], "barcode": row[2]} for row in cursor.fetchall()]
        return jsonify(items)
        
    elif request.method == 'POST':
        item_name = request.json.get('item_name')
        if not item_name:
            return jsonify({"error": "Missing item name"}), 400
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute("INSERT INTO pantry (barcode, item_name) VALUES (?, ?)", ("MANUAL", item_name))
        return jsonify({"status": "success"})

    elif request.method == 'DELETE':
        item_id = request.json.get('id')
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute("DELETE FROM pantry WHERE id = ?", (item_id,))
        return jsonify({"status": "success"})

@app.route('/api/generate-recipes', methods=['POST'])
def generate_recipes():
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT item_name FROM pantry")
        items = [row[0] for row in cursor.fetchall()]
    
    if not items:
        return jsonify({"recipes": "Your pantry is empty! Scan or type some items first."})
        
    ingredients = ", ".join(items)
    
    try:
        # Call Meta's Llama 3 model via Groq's super-fast free tier
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "user",
                    "content": f"Act as a creative chef. Look at these pantry ingredients: {ingredients}. Generate 2 unique, realistic recipes I can make using these items. Keep instructions brief and punchy."
                }
            ],
            temperature=0.7,
            max_tokens=500
        )
        ai_response = completion.choices.message.content
        return jsonify({"recipes": ai_response})
    except Exception as e:
        return jsonify({"recipes": f"AI Chef went on strike: Ensure your GROQ_API_KEY is configured in Render. (Error: {str(e)})"})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
