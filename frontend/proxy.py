#!/usr/bin/env python3
"""
NEAR RPC Proxy Server
Bypasses CORS restrictions for local development
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import json

NEAR_RPC = 'https://rpc.testnet.near.org'

class CORSProxyHandler(SimpleHTTPRequestHandler):
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/rpc':
            # Proxy to NEAR RPC
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                req = urllib.request.Request(
                    NEAR_RPC,
                    data=body,
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=30) as response:
                    result = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(result)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    port = 8081
    server = HTTPServer(('', port), CORSProxyHandler)
    print(f'🚀 NEAR RPC Proxy running on http://localhost:{port}/rpc')
    print(f'   Proxying to {NEAR_RPC}')
    server.serve_forever()
