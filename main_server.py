from http.server import HTTPServer, BaseHTTPRequestHandler
from http import HTTPStatus

from common_openai import Translator

translator = Translator()

class MyHandler(BaseHTTPRequestHandler):
    def _set_headers(self):
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-type', 'text/html; charset=utf-8')

        self.send_header('Access-Control-Allow-Origin', '*') 
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

        
    def do_GET(self):
        self._set_headers()
        self.wfile.write(b"received get request")
        
    def do_POST(self):
        content_len = int(self.headers.get('content-length', 0))
        post_body = self.rfile.read(content_len)

        translation, diff_time = translator.process(post_body.decode('utf-8'))

        print(f"{diff_time}: ", end="", flush=True)
        self._set_headers() 
        self.wfile.write(translation.strip().encode())
    
def run(server_class=HTTPServer, handler_class=MyHandler):
    server_address = ('', 8000)
    httpd = server_class(server_address, handler_class)
    print("starting to serve on 8000")
    httpd.serve_forever()


if __name__ == "__main__":
    run()

