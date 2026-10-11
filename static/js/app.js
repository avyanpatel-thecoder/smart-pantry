var codeReader = null;
var pantryApp = {
    startScan: function() {
        document.getElementById("video-mask").style.display = "none";
        document.getElementById("laser-hud").style.display = "block";
        document.getElementById("cam-btn").innerText = "Scanning...";
        if (!codeReader) { codeReader = new ZXing.BrowserBarcodeReader(); }
        codeReader.decodeFromInputVideoDevice(undefined, "video-stream")
        .then(function(result) { pantryApp.onCaptureSuccess(result.text); })
        .catch(function(err) { alert("Camera configuration error."); });
    },
    onCaptureSuccess: function(barcodeString) {
        document.getElementById("scan-feedback").innerText = "Captured: " + barcodeString;
        if (navigator.vibrate) navigator.vibrate(100);
        if (codeReader) { codeReader.reset(); }
        document.getElementById("video-mask").style.display = "flex";
        document.getElementById("laser-hud").style.display = "none";
        document.getElementById("cam-btn").innerText = "Start Scanner";
        fetch("/api/scan", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ barcode: barcodeString })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) { pantryApp.loadVaultData(); });
    },
    loadVaultData: function() {
        fetch("/api/pantry")
        .then(function(r) { return r.json(); })
        .then(function(items) {
            var list = document.getElementById("stock-list");
            document.getElementById("stock-count").innerText = items.length + " items";
            if (items.length === 0) {
                list.innerHTML = '<div class="text-center py-4 text-gray-400 text-xs">Your shelves are currently empty.</div>';
                return;
            }
            list.innerHTML = "";
            for (var i = 0; i < items.length; i++) {
                var currentItem = items[i];
                list.innerHTML += '<li class="flex justify-between items-center py-3 text-xs font-bold text-gray-800"><span>' + currentItem.item_name + '</span><button onclick="pantryApp.removeItemRow(' + currentItem.id + ')" class="text-gray-300 hover:text-red-500 p-1">✕</button></li>';
            }
        });
    },
    addManualItem: function() {
        var el = document.getElementById("manual-text");
        if(!el.value) return;
        fetch("/api/pantry", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ item_name: el.value }) })
        .then(function() { el.value = ""; pantryApp.loadVaultData(); });
    },
    removeItemRow: function(id) {
        fetch("/api/pantry", { method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id: id }) })
        .then(function() { pantryApp.loadVaultData(); });
    },
    askChefForMeals: function() {
        var out = document.getElementById("recipe-box");
        out.classList.remove("hidden");
        out.innerHTML = '<div class="animate-pulse text-emerald-600 font-extrabold text-xs">AI Chef is building custom recipe modules...</div>';
        fetch("/api/generate-recipes", { method: "POST" })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var raw = d.recipes || "Error processing prompt sequences.";
            var cleanText = raw.replace(/[*#]/g, "");
            out.innerHTML = '<div class="font-semibold text-gray-600 space-y-1">' + cleanText + '</div>';
        });
    }
};
pantryApp.loadVaultData();
