from flask import Flask, render_template, request

from backend.models.user import User


app = Flask(__name__)


@app.route("/")
def index():
    return render_template("login.html")


@app.post("/login")
def authentifier():
    data = request.form.to_dict()
    utilisateur = User.model_validate(data)
    # Service.authentifier(utilisateur)

    return render_template("welcome.html", user=utilisateur)


if __name__ == "__main__":
    app.run(debug=True)
