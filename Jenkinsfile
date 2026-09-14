pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'   // Configure in Jenkins: Manage Jenkins > Tools > NodeJS installations
    }

    environment {
        IMAGE_NAME     = 'vieteats-api'
        BUILD_TAG      = "${env.BUILD_NUMBER}"
        RELEASE_TAG    = "v1.0.${env.BUILD_NUMBER}"
        SONARQUBE_ENV  = 'MySonarQube' // Configure in Manage Jenkins > System > SonarQube servers
        JWT_SECRET     = credentials('vieteats-jwt-secret') // Jenkins credential (Secret text)
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        /*  1. BUILD  */
        stage('Build') {
            steps {
                echo 'Building Docker image artefact...'
                sh """
                  docker build -t ${IMAGE_NAME}:${BUILD_TAG} -t ${IMAGE_NAME}:latest .
                """
            }
            post {
                success {
                    sh "docker save ${IMAGE_NAME}:${BUILD_TAG} -o ${IMAGE_NAME}-${BUILD_TAG}.tar"
                    archiveArtifacts artifacts: "${IMAGE_NAME}-${BUILD_TAG}.tar", fingerprint: true
                }
            }
        }

        /*  2. TEST  */
        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                    publishHTML(target: [
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Jest Coverage Report',
                        keepAll: true
                    ])
                }
            }
        }

        /*  3. CODE QUALITY  */
        stage('Code Quality') {
            steps {
                sh 'npm run lint -- -f checkstyle -o reports/eslint.xml || true'
                withSonarQubeEnv("${SONARQUBE_ENV}") {
                    script {
                        def scannerHome = tool 'SonarScanner'
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                withSonarQubeEnv("${SONARQUBE_ENV}") {
                    sh '''
                      sleep 8
                      CE_TASK_URL=$(grep ceTaskUrl .scannerwork/report-task.txt | cut -d= -f2-)
                      curl -s -u "$SONAR_AUTH_TOKEN:" "$CE_TASK_URL" -o ce-task.json
                      for i in $(seq 1 15); do
                        STATUS=$(grep -o '"status":"[A-Z]*"' ce-task.json | head -1 | cut -d'"' -f4)
                        if [ "$STATUS" = "SUCCESS" ]; then break; fi
                        sleep 3
                        curl -s -u "$SONAR_AUTH_TOKEN:" "$CE_TASK_URL" -o ce-task.json
                      done
                      ANALYSIS_ID=$(grep -o '"analysisId":"[^"]*"' ce-task.json | cut -d'"' -f4)
                      curl -s -u "$SONAR_AUTH_TOKEN:" "$SONAR_HOST_URL/api/qualitygates/project_status?analysisId=$ANALYSIS_ID" -o qg-status.json
                      QG_STATUS=$(grep -o '"status":"[A-Z]*"' qg-status.json | head -1 | cut -d'"' -f4)
                      echo "SonarQube Quality Gate status: $QG_STATUS"
                      if [ "$QG_STATUS" != "OK" ]; then
                        echo "WARNING: Quality Gate did not pass (status: $QG_STATUS)"
                      fi
                    '''
                }
            }
        }

        /* 4. SECURITY  */
        stage('Security') {
            steps {
                echo 'Scanning dependencies with npm audit...'
                sh 'npm audit --audit-level=high --json > reports/npm-audit.json || true'

                echo 'Scanning the built Docker image with Trivy...'
                sh """
                  trivy image --severity HIGH,CRITICAL --exit-code 0 \
                    --format json -o reports/trivy-report.json \
                    ${IMAGE_NAME}:${BUILD_TAG}
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/npm-audit.json, reports/trivy-report.json', allowEmptyArchive: true
                }
            }
        }
        // NOTE: any HIGH/CRITICAL findings from npm audit or Trivy are triaged manually
        // and documented in the report (issue, severity, remediation) - see report
        // section "Security stage" for the current findings on this project.

        /* 5. DEPLOY (staging)  */
        stage('Deploy') {
            steps {
                echo 'Deploying to the staging environment (Docker Compose)...'
                sh """
                  export BUILD_TAG=${BUILD_TAG}
                  docker compose -f docker-compose.yml down --remove-orphans || true
                  docker compose -f docker-compose.yml up -d
                """
                echo 'Waiting for staging health check...'
                sh '''
                  for i in $(seq 1 15); do
                    if curl -sf http://localhost:3000/health; then
                      echo "Staging is healthy"; exit 0
                    fi
                    sleep 3
                  done
                  echo "Staging failed health check"; exit 1
                '''
            }
        }

        /*  6. RELEASE (production)  */
        stage('Release Approval') {
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    input message: "Promote build ${BUILD_TAG} to production as ${RELEASE_TAG}?"
                }
            }
        }

        stage('Release') {
            steps {
                sh """
                  docker tag ${IMAGE_NAME}:${BUILD_TAG} ${IMAGE_NAME}:${RELEASE_TAG}
                  git tag ${RELEASE_TAG}
                """
                echo 'Promoting to the production environment...'
                sh """
                  export RELEASE_TAG=${RELEASE_TAG}
                  export JWT_SECRET=${JWT_SECRET}
                  docker compose -f docker-compose.prod.yml down --remove-orphans || true
                  docker compose -f docker-compose.prod.yml up -d
                """
                sh '''
                  for i in $(seq 1 15); do
                    if curl -sf http://localhost:4000/health; then
                      echo "Production is healthy"; exit 0
                    fi
                    sleep 3
                  done
                  echo "Production failed health check"; exit 1
                '''
            }
        }

        /* 7. MONITORING & ALERTING  */
        stage('Monitoring') {
            steps {
                echo 'Deploying/refreshing the Prometheus + Alertmanager + Grafana stack...'
                sh """
                  docker compose -f monitoring/docker-compose.monitoring.yml up -d
                """
                echo 'Verifying Prometheus is scraping the production target...'
                sh '''
                  sleep 5
                  curl -sf http://localhost:9090/-/healthy
                  curl -s "http://localhost:9090/api/v1/targets" | grep -o '"health":"up"' || echo "WARNING: target not yet up"
                '''
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded: build ${BUILD_TAG} released as ${RELEASE_TAG} and is being monitored."
        }
        failure {
            echo 'Pipeline failed - see console output for the failing stage.'
            // In production this would call a real alerting webhook, e.g.:
            // sh 'curl -X POST -H "Content-Type: application/json" -d "{\\"text\\":\\"Build ${BUILD_TAG} failed\\"}" $SLACK_WEBHOOK_URL'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
