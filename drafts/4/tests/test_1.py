import time
import threading
import requests

html_host = "http://localhost:8080" 
api_host = "http://localhost:3000"
test_amount = 8

class Request:
    host: str
    response: requests.Response
    timeTook: float

    def __init__(self, host: str) -> None:
        self.host = host

    def make_request(self) -> None:
        now = time.time()
        self.reponse = requests.get(self.host)
        self.timeTook = time.time() - now

def send_requests(host: str) -> None:
    threads: list[threading.Thread] = []
    reqs: list[Request] = []
    
    for i in range(0, test_amount):
        req = Request(host)
        thread = threading.Thread(target=req.make_request)
        reqs.append(req)
        threads.append(thread)
    
    for t in threads:
        t.start()
        time.sleep(0.01)
    
    for t in threads:
        t.join()
    
    for i in range(0, test_amount):
        print(str(i + 1) + ": took ", reqs[i].timeTook)

print("html host:")
print("------------------------------------------------------------")
send_requests(html_host)
print("------------------------------------------------------------")
print("api host: ")
print("------------------------------------------------------------")
send_requests(api_host)
print("------------------------------------------------------------")
