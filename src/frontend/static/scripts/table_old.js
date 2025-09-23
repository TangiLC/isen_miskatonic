(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("loadQ");
    const result = document.getElementById("resultMessage");
    const scrollCard = document.getElementById("scroll-card");
    const table = document.getElementById("questionsTable");
    const tbody = table.querySelector("tbody");

    const { token, apiUrl, userId } = window.APP_CONFIG || {};
    let fullData = [];

    function renderActionIcon({ src, title, onClick }) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-icon-btn";
      btn.title = title;
      btn.setAttribute("aria-label", title);

      const img = new Image();
      img.src = src;                            
      img.alt = title;

      btn.appendChild(img);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return btn;
    }


    function renderTable(data) {
      tbody.innerHTML = "";
      for (const item of data) {
        const tr = document.createElement("tr");

        const tdId = document.createElement("td");
        tdId.textContent = String(item.id ?? "").toString().slice(-4);
        tr.appendChild(tdId);

        const tdQ = document.createElement("td");
        const q = item.question ?? "";
        tdQ.textContent = `${q.slice(0, 50)}${q.length > 50 ? "..." : ""}`;
        tr.appendChild(tdQ);

        const tdS = document.createElement("td");
        tdS.textContent = item.subject ?? "";
        tr.appendChild(tdS);

        const tdU = document.createElement("td");
        tdU.textContent = item.use ?? "";
        tr.appendChild(tdU);

        const tdC = document.createElement("td");
        tdC.textContent = item.created_by ?? "";
        tr.appendChild(tdC);

        const tdD = document.createElement("td");
        const created = item.created_at ? new Date(item.created_at).getTime() : 0;
        const edited = item.edited_at ? new Date(item.edited_at).getTime() : 0;
        const d = new Date(Math.max(created, edited) || Date.now());
        tdD.textContent = d.toLocaleDateString("fr-FR",{day: "2-digit",month: "2-digit",year: "2-digit"});
        tr.appendChild(tdD);

        const tdA = document.createElement("td");
        tdA.appendChild(
          renderActionIcon({
            src: "/static/assets/icon-eye.svg",
            title: "Voir les détails",
            onClick: () => see_details(item.id)
          })
        );

        const editBtn = renderActionIcon({
          src: "/static/assets/icon-edit.svg",
          title: "Éditer la question",
          onClick: () => edit_question(item.id)
        });

        if (String(item.created_by) !== String(userId)) {
          editBtn.disabled = true;
          editBtn.classList.add("disabled");
        }

        tdA.appendChild(editBtn);

        tdA.appendChild(
          renderActionIcon({
            src: "/static/assets/icon-add.svg",
            title: "Ajouter au quizz",
            onClick: () => add_to_quizz(item.id)
          })
        );

tr.appendChild(tdA);
      
        tbody.appendChild(tr);
      }

      scrollCard.style.display = data.length ? "inline-block" : "none";
    }

    btn.addEventListener("click", async () => {
      result.textContent = "Chargement…";
      try {
        const resp = await fetch(`${apiUrl}/questions`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json"
          }
        });

        if (!resp.ok) {
          result.textContent = `Erreur ${resp.status}`;
          renderTable([]);
          return;
        }

        const response = await resp.json();
        fullData = Array.isArray(response) ? response : [];
        renderTable(fullData);

        result.textContent = fullData.length
          ? `Chargement complet : ${fullData.length} questions trouvées`
          : "Aucune question trouvée";
      } catch (err) {
        result.textContent = "Échec de la requête : " + err;
        renderTable([]);
      }
    });
  });
})();
