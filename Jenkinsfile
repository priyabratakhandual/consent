pipeline {
    agent any

    environment {
        SERVER = "ubuntu@YOUR_SERVER_IP"
        APP_DIR = "/home/ubuntu/node-app"
        APP_NAME = "node-app"
    }

    stages {

        stage('Clone Code') {
            steps {
                git branch: 'main', url: 'https://github.com/your-repo.git'
            }
        }

        stage('Deploy to EC2') {
            steps {
                sshagent(['ssh-key-id']) {

                    withCredentials([string(credentialsId: 'env-file', variable: 'ENV_FILE')]) {

                        sh """
                        ssh -o StrictHostKeyChecking=no $SERVER '

                            # Install Docker if not installed
                            sudo apt update -y
                            sudo apt install -y docker.io docker-compose

                            # Give permission
                            sudo usermod -aG docker ubuntu || true

                            # Create app directory
                            mkdir -p $APP_DIR
                        '

                        # Copy project files to EC2
                        scp -r -o StrictHostKeyChecking=no * $SERVER:$APP_DIR/

                        ssh -o StrictHostKeyChecking=no $SERVER '

                            # Create .env from Jenkins
                            echo "$ENV_FILE" > $APP_DIR/.env

                            cd $APP_DIR

                            # Stop old container
                            docker-compose down || true

                            # Build and run new container
                            docker-compose up -d --build
                        '
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo "✅ Deployment successful!"
        }
        failure {
            echo "❌ Deployment failed. Check logs."
        }
    }
}