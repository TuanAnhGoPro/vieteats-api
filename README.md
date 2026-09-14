# VietEats API — SIT223/SIT753 HD DevOps Pipeline

A Node.js/Express REST API + simple static frontend for **VietEats**, a
community-contributed directory of cafés/restaurants across Vietnam (JWT auth,
CRUD, MongoDB), used as the demo project for the 7-stage Jenkins pipeline:
**Build → Test → Code Quality → Security → Deploy → Release → Monitoring**.

## 1. Project structure

```
vieteats-api/
├── src/                      # application code (routes, controllers, models)
├── public/                    # simple static frontend (index.html/style.css/app.js)
├── tests/                    # Jest + Supertest integration tests
├── monitoring/                # Prometheus / Alertmanager / Grafana stack
├── Dockerfile                 # multi-stage build → production image (Build stage artefact)
├── docker-compose.yml         # staging environment (Deploy stage)
├── docker-compose.prod.yml    # production environment (Release stage)
├── sonar-project.properties   # SonarQube scanner config (Code Quality stage)
├── .eslintrc.json             # ESLint rules (Code Quality stage)
└── Jenkinsfile                 # the 7-stage declarative pipeline
```

## 2. Run the app locally (sanity check before wiring Jenkins)

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:3000/health should return {"status":"UP"}
npm test           # runs Jest with an in-memory MongoDB, no external DB needed
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: VietEats API with Jenkins DevOps pipeline"
git branch -M main
git remote add origin https://github.com/<your-username>/vieteats-api.git
git push -u origin main
```
Remember to add your **marker and the Unit Chair** as collaborators (or make
the repo public) so they can view the code.

## 4. Run Jenkins locally with Docker Desktop

Build the provided `Dockerfile.jenkins` once — it's a normal Jenkins image
with the Docker CLI baked in, which is the most reliable way to let Jenkins
run `docker build` / `docker compose` against your Docker Desktop engine on
Windows, macOS, or Linux (it avoids the flaky "mount the host's docker
binary" trick, which breaks whenever host/container OS don't match):

```bash
docker build -t jenkins-with-docker -f Dockerfile.jenkins .

docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins-with-docker
```

Open `http://localhost:8080`, unlock Jenkins with the initial admin password:

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Install the **suggested plugins**, then add these extra plugins under
*Manage Jenkins → Plugins*:
- Docker Pipeline
- NodeJS Plugin
- SonarQube Scanner
- JUnit
- HTML Publisher

## 5. Configure Jenkins tools & credentials

- **Manage Jenkins → Tools → NodeJS installations**: add `NodeJS-20` (Node 20.x).
- **Manage Jenkins → Credentials**: add a *Secret text* credential with ID
  `vieteats-jwt-secret` (any random string) — used as the production `JWT_SECRET`.
- **Manage Jenkins → System → SonarQube servers**: add a server named
  `MySonarQube` pointing at your SonarQube instance (see step 6) with a
  generated token credential.

## 6. Run SonarQube locally (Code Quality stage)

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```
Log in at `http://localhost:9000` (admin/admin), generate a token under
*My Account → Security*, and use it as the Jenkins SonarQube credential.

## 7. Security stage tools

- `npm audit` runs out of the box — no extra setup needed.
- **Trivy** is invoked from the pipeline via `docker run aquasec/trivy`, so
  Docker Desktop is the only prerequisite (the image is pulled automatically
  on first run).

## 8. Create the pipeline job

*New Item → Pipeline → "Pipeline script from SCM"* → Git → your GitHub URL →
Script Path `Jenkinsfile`. Optionally add a GitHub webhook
(`http://<your-public-jenkins-url>/github-webhook/`) for automatic triggers,
or just click **Build Now** for the demo.

## 9. What each stage does

| Stage | Tooling | What happens |
|---|---|---|
| Build | Docker | Builds a multi-stage production Docker image, archives it as a `.tar` artefact |
| Test | Jest, Supertest, mongodb-memory-server | Runs 11 integration tests (auth + place CRUD) against an in-memory MongoDB, publishes JUnit + coverage reports |
| Code Quality | ESLint, SonarQube, Quality Gate | Lints the code, runs static analysis, pipeline aborts if the Sonar Quality Gate fails |
| Security | npm audit, Trivy | Scans dependencies and the built container image for HIGH/CRITICAL vulnerabilities |
| Deploy | Docker Compose | Spins up the app + MongoDB on a staging network (port 3000), verifies `/health` |
| Release | Docker tag, Git tag, Docker Compose | Manual approval gate, tags the image/commit with a semantic version, promotes to a production compose stack (port 4000) |
| Monitoring | Prometheus, Alertmanager, Grafana | Deploys the monitoring stack, scrapes `/metrics`, verifies the target is `up`, alert rules watch for downtime/5xx/latency |

## 10. Recording the demo video (≤10 min)

1. Clone the repo fresh and show the project structure (~1 min).
2. Show the Jenkins job configuration and trigger a build.
3. Let it run through all 7 stages in the Jenkins UI (Blue Ocean view is nice
   for this), briefly narrating each stage as it goes green.
4. Show the SonarQube dashboard and the Trivy/npm-audit report artefacts.
5. Hit the approval `input` step for Release, approve it.
6. Curl `http://localhost:4000/health` and demo a couple of API calls
   (register, login, add a café or restaurant) with Postman/curl against the production
   port.
7. Open Prometheus (`localhost:9090/targets`) showing the target as `UP`,
   and Grafana (`localhost:3001`) with a live dashboard.

## 11. Known security findings (fill in with your actual scan results)

Document any HIGH/CRITICAL findings from `npm audit` / Trivy here: what the
issue is, its severity, and how you addressed it (upgraded a package,
excluded a false positive, accepted the risk with justification, etc.).
