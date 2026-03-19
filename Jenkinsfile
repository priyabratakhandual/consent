pipeline {
    agent any

    environment {
        APP_NAME = "node-app"
    }

    stages {

        stage('Clone Code') {
            steps {
                git branch: 'main', url: 'https://github.com/priyabratakhandual/consent.git'
            }
        }

        stage('Create .env') {
            steps {
                withCredentials([string(credentialsId: 'env-file', variable: 'ENV_FILE')]) {
                    sh '''
                    cp $ENV_FILE .env
                    '''
                }
            }
        }

        stage('Stop Old Container') {
            steps {
                sh '''
                docker stop node-app || true
                docker rm node-app || true
                '''
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                docker build -t node-app .
                '''
            }
        }

        stage('Run Container') {
            steps {
                sh '''
                docker run -d \
                --name node-app \
                --env-file .env \
                -p 3000:3000 \
                node-app
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Deployment successful!"
        }
        failure {
            echo "❌ Deployment failed!"
        }
    }
}