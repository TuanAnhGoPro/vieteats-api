# VietEats API — my SIT223/SIT753 HD DevOps pipeline

This is my project for the HD DevOps task. It's a small directory site for
cafes and restaurants around Vietnam — people can browse places by city and
category, and once they log in they can add their own spots. I picked this
over a generic to-do app mainly because it still has real auth + CRUD, but
also gave me something I could actually show off in the demo video instead
of just poking the API with curl.

The whole thing is wired up to a Jenkins pipeline with all 7 stages: **Build
→ Test → Code Quality → Security → Deploy → Release → Monitoring**.

## What's in here

```
vieteats-api/
├── src/                # the API - routes, controllers, models
├── public/              # plain HTML/CSS/JS frontend, served by Express
├── tests/               # Jest + Supertest tests
├── monitoring/           # Prometheus / Alertmanager / Grafana config
├── Dockerfile            # multi-stage build -> the production image (Build stage)
├── docker-compose.yml    # staging environment (Deploy stage)
├── docker-compose.prod.yml  # production environment (Release stage)
├── sonar-project.properties # SonarQube config (Code Quality stage)
├── .eslintrc.json        # ESLint rules (Code Quality stage)
└── Jenkinsfile            # the actual 7-stage pipeline
```

## Running it locally first (before touching Jenkins)

Worth doing this once just to make sure the app itself works before wiring
up the pipeline — saves you from debugging Jenkins and your own code at the
same time.

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:3000/health should say {"status":"UP"}
npm test           # Jest + an in-memory Mongo, no real DB needed
```

## Getting it onto GitHub

```bash
git init
git add .
git commit -m "Initial commit: VietEats API with Jenkins DevOps pipeline"
git branch -M main
git remote add origin https://github.com/<your-username>/vieteats-api.git
git push -u origin main
```

Don't forget to give the Marker and Unit Chair access — easiest is just to
make the repo public.

## Setting up Jenkins with Docker Desktop

I run Jenkins itself in a container that also has the Docker CLI installed
inside it, using `Dockerfile.jenkins`. This turned out to be way more
reliable than trying to mount the host's `docker` binary into the container
(that trick breaks constantly depending on your OS).

```bash
docker build -t jenkins-with-docker -f Dockerfile.jenkins .

docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins-with-docker
```

Note: on some setups Jenkins can't actually reach the Docker socket unless
the container runs as root — if you hit a "permission denied" error talking
to `/var/run/docker.sock` later on, add `--user root` to the command above.

Open `http://localhost:8080` and grab the first-run password:

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Go with "Install suggested plugins", then also add these under *Manage
Jenkins → Plugins*, since the pipeline needs them:
- Docker Pipeline
- NodeJS Plugin
- SonarQube Scanner
- HTML Publisher

## Jenkins config before the first run

- **Manage Jenkins → Tools**: add a NodeJS installation named `NodeJS-20`
  (has to match that exact name, it's what the Jenkinsfile refers to).
- **Manage Jenkins → Credentials**: add a *Secret text* credential, ID
  `vieteats-jwt-secret`, value = any random string. This becomes the
  production `JWT_SECRET`.
- **Manage Jenkins → System → SonarQube servers**: point it at the SonarQube
  instance from the next step, name it `MySonarQube` (again, has to match
  what's in the Jenkinsfile).

## SonarQube (for the Code Quality stage)

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```

Log in at `http://localhost:9000` with `admin`/`admin`, it'll make you change
the password. Then go to *My Account → Security* and generate a token —
that's what goes into the Jenkins SonarQube credential above.

## Security stage — nothing extra to install

`npm audit` just works out of the box. Trivy is called via
`docker run aquasec/trivy` directly from the pipeline, so as long as Docker
Desktop is running it'll pull the image itself the first time (takes a
minute or two on the very first run).

## Creating the pipeline job

*New Item → Pipeline* → under Pipeline settings pick "Pipeline script from
SCM" → Git → paste your GitHub repo URL → Script Path = `Jenkinsfile` → Save,
then **Build Now**.

## What each stage actually does

| Stage | Tools | Notes |
|---|---|---|
| Build | Docker | Multi-stage Dockerfile build, image tagged with the build number and archived as a `.tar` |
| Test | Jest, Supertest, mongodb-memory-server | 11 tests covering auth + place CRUD, results published as JUnit + coverage |
| Code Quality | ESLint, SonarQube | Static analysis + a quality gate that fails the build if it doesn't pass |
| Security | npm audit, Trivy | Scans dependencies and the built image, reports archived |
| Deploy | Docker Compose | Brings up app + Mongo on staging (port 3000), checks `/health` |
| Release | Docker/Git tags, Docker Compose, manual approval | Waits for someone to click Proceed, then promotes to production (port 4000) |
| Monitoring | Prometheus, Alertmanager, Grafana | Brings up the monitoring stack, confirms Prometheus is scraping `/metrics` |

## Recording the demo video

Roughly how I'm planning to structure mine (under 10 minutes):

1. Quick look at the repo structure.
2. Trigger a build in Jenkins, let it run through all 7 stages.
3. Show the SonarQube results and the security scan reports.
4. Approve the Release step when it pauses for input.
5. Open the app at `localhost:4000`, register/log in, add a place — show it
   actually works, not just that the pipeline turned green.
6. Quick look at Prometheus (`localhost:9090/targets`) and Grafana
   (`localhost:3001`) to show monitoring is live.

## Security scan results

TODO once I've actually run a full pipeline: paste what npm audit / Trivy
found here, how severe it was, and what I did about it.

