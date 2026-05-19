import requests

login_url = "http://127.0.0.1:8000/api/auth/login/"
res = requests.post(login_url, json={"phone": "01000000000", "password": "Admin123456!"})
if res.status_code != 200:
    print("Login Failed:", res.status_code, res.text)
    exit(1)

tokens = res.json()
access_token = tokens["access"]
print("Logged in successfully. Access token retrieved.")

reports_url = "http://127.0.0.1:8000/api/admin/reports/"
headers = {"Authorization": f"Bearer {access_token}"}
res = requests.get(reports_url, headers=headers)
print("Reports URL:", reports_url)
print("Status Code:", res.status_code)
print("Response JSON:", res.json())
