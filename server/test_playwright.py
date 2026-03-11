from nova_act import NovaAct
import os
# Test playwrite api installation and configuration

def test_playwright():
    key = os.environ["NOVA_ACT_API_KEY"]
    with NovaAct(nova_act_api_key=key, starting_page="https://google.com") as nova:
        result = nova.act("Test Playwright")
        print("Playwright test result:", result)
        nova.stop()
        return