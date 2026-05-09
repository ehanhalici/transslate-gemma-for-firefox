browser.runtime.onInstalled.addListener(() => {
  browser.action.setBadgeText({ text: "KPLI" });
  browser.action.setBadgeBackgroundColor({ color: "#ef4444" });
});

browser.action.onClicked.addListener((tab) => {
  browser.tabs.sendMessage(tab.id, { action: "toggle" })
    .then((response) => {
      if (response && response.state) {
        browser.action.setBadgeText({ text: "AÇIK", tabId: tab.id });
        browser.action.setBadgeBackgroundColor({ color: "#3b82f6", tabId: tab.id });
      } else {
        browser.action.setBadgeText({ text: "KPLI", tabId: tab.id });
        browser.action.setBadgeBackgroundColor({ color: "#ef4444", tabId: tab.id });
      }
    })
    .catch((err) => {
      console.log("[TGemma] Sayfa dinlemiyor, sayfayı yenileyin.");
      browser.action.setBadgeText({ text: "YNL", tabId: tab.id });
      browser.action.setBadgeBackgroundColor({ color: "#f59e0b", tabId: tab.id });
    });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    browser.action.setBadgeText({ text: "KPLI", tabId: tabId });
    browser.action.setBadgeBackgroundColor({ color: "#ef4444", tabId: tabId });
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translate") {
    
    fetch("http://localhost:8000/", {
      method: "POST",
      body: message.htmlContent
    })
    .then(response => {
      if (!response.ok) throw new Error("Ağ hatası: " + response.status);
      
      return response.text(); 
    })
    .then(translatedText => {
      sendResponse({ success: true, data: translatedText });
    })
    .catch(error => {
      console.error("[TGemma Proxy Hatası]:", error);
      sendResponse({ success: false, error: error.message });
    });

    return true;
  }
});
