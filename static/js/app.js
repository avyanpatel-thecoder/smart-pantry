var codeReader = null;
var pantryApp = {
    startScan: function() {
        var btn = document.getElementById("cam-btn");
        btn.innerText = "Connecting...";
        
        // Requests explicit video track access
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function(stream) {
            stream.getTracks().forEach(function(track) { track.stop(); });
            
            document.getElementById("video-mask").style.display = "none";
            document.getElementById("laser-hud").style.display = "block";
            btn.innerText = "Scanning...";
            btn.className = "bg-gray-300 text-gray-600 font-extrabold text-[11px] uppercase tracking-widest px-4 py-2 rounded-xl shadow-sm cursor-not-allowed";
            
            // FIXED: Using standard MultiFormatReader for broad browser webcam cross-compatibility
            if (!codeReader) { codeReader = new ZXing.BrowserMultiFormatReader(); }
            
            // FIXED: Explicitly maps the video tag ID string as the destination stream window
            codeReader.decodeFromVideoDevice(undefined, "video-stream", function(result, err) {
                if (result) {
                    pantryApp.onCaptureSuccess(result.text);
                }
            });
        })
        .catch(function(err) {
            btn.innerText = "Start Scanner";
            alert("Hardware stream block: Please verify browser permission overlays.");
        });
    },
    onCaptureSuccess: function(barcodeString) {
        var feedback = document.getElementById("scan-feedback");
        feedback.innerText = "Captured: " + barcodeString;
        if (navigator.vibrate) navigator.vibrate(100);
        if (codeReader) { codeReader.reset(); }
        
        document.getElementById("video-mask").style.display = "flex";
        document.getElementById("laser-hud").style.display = "none";
        document.getElementById("cam-btn").innerText = "Start Scanner";
        document.getElementById("cam-btn").className = "bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[11px] uppercase tracking-widest px-4 py-2 rounded-xl shadow-md";
        
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
            var targetWrapper = document.createElement("div");
            targetWrapper.className = "font-semibold text-gray-600 space-y-1";
            targetWrapper.innerText = cleanText;
            out.innerHTML = "";
            out.appendChild(targetWrapper);
        });
    }
};
pantryApp.loadVaultData();
