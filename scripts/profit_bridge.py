"""
Profit Pro Real-Time Bridge (DDE/RTD -> Web App)
------------------------------------------------
Este script lê cotações em tempo real do Profit Pro (Nelogica) via DDE/RTD
e disponibiliza uma API HTTP local na porta 5001 para o Aplicativo Financeiro.

Requisitos:
    pip install flask flask-cors pywin32

Uso:
    python profit_bridge.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import win32ui
import dde
import datetime

app = Flask(__name__)
CORS(app)

# Cache de cotações em memória
quotes_cache = {}

def get_profit_quote(ticker):
    """
    Tenta ler a cotação do Profit Pro via DDE.
    Tópico padrão do Profit: App='profitchart', Topic='cot'
    Item: '<TICKER>.ULT' (Último preço), '<TICKER>.ABE', etc.
    """
    clean_ticker = ticker.upper().strip()
    
    try:
        server = dde.CreateServer()
        server.Create("ProfitClient")
        conv = dde.CreateConversation(server)
        conv.ConnectTo("profitchart", "cot")
        
        last_str = conv.Request(f"{clean_ticker}.ULT")
        bid_str = conv.Request(f"{clean_ticker}.OFC") # Melhor compra
        ask_str = conv.Request(f"{clean_ticker}.OFV") # Melhor venda
        
        price = float(last_str.replace(',', '.')) if last_str else 0.0
        bid = float(bid_str.replace(',', '.')) if bid_str else price
        ask = float(ask_str.replace(',', '.')) if ask_str else price
        
        return {
            "ticker": clean_ticker,
            "price": price,
            "bid": bid,
            "ask": ask,
            "source": "profit_bridge",
            "lastUpdated": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        # Se o Profit não estiver conectado ou DDE desativado, retorna cache ou erro
        if clean_ticker in quotes_cache:
            return quotes_cache[clean_ticker]
        return None

@app.route('/quote', methods=['GET'])
def quote():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "Ticker obrigatório"}), 400
    
    data = get_profit_quote(ticker)
    if data:
        quotes_cache[ticker.upper().strip()] = data
        return jsonify(data)
    
    return jsonify({"error": "Ativo não encontrado no Profit", "ticker": ticker}), 404

@app.route('/quotes', methods=['POST'])
def quotes_batch():
    body = request.get_json() or {}
    tickers = body.get('tickers', [])
    result = {}
    
    for t in tickers:
        data = get_profit_quote(t)
        if data:
            result[t.upper().strip()] = data
            
    return jsonify({"quotes": result})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "running", "bridge": "Profit Pro DDE", "port": 5001})

if __name__ == '__main__':
    print("=====================================================")
    print("🚀 Profit Pro Real-Time Bridge ativo na porta 5001")
    print("Conectado ao aplicativo de Finanças (Next.js)")
    print("=====================================================")
    app.run(host='127.0.0.1', port=5001, debug=False)
