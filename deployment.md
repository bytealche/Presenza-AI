## 1. Local Production (Docker Compose)
The easiest way to run Presenza in a production-like environment on your local server or a dedicated VM.
**Note**: Requires Docker Desktop installed and running.

### Prerequisites
- Docker & Docker Compose installed.
- Camera devices on the same network (for mobile streaming).

### Configuration (`docker-compose.yml`)
Ensure your `docker-compose.yml` is configured correctly.
- **Backend Port**: 8000
- **Frontend Port**: 3000

#### Environment Variables
Create a `.env` file in the root if you have secrets (Database URL, Keys).
```bash
SECRET_KEY=your_production_secret_key
DATABASE_URL=sqlite:///./presenza.db # Or PostgreSQL url
```

### Steps
1. **Build and Run**:
   ```bash
   # Use 'docker compose' (v2) or 'docker-compose' (v1) depending on your install
   docker compose up --build -d
   ```
   **OR via PowerShell Script (No Docker):**
   ```powershell
   .\start_production.ps1
   ```
2. **Access**:
   - Frontend: `http://localhost:3000` (or `http://YOUR_SERVER_IP:3000`)
   - Backend API: `http://localhost:8000`

---

## 2. Cloud VM Deployment (AWS EC2 / DigitalOcean Droplet)
Recommended for real-world usage to allow access from anywhere.

### Steps
1. **Provision VM**: Launch an Ubuntu 22.04 instance.
2. **Install Docker**:
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose
   ```
3. **Clone Repository**:
   ```bash
   git clone <your-repo-url>
   cd Presenza-AI
   ```
4. **Update IP Configuration**:
   - In `docker-compose.yml`, ensure `frontend` allows external access.
   - The default `NEXT_PUBLIC_API_URL` logic in `frontend/src/utils/config.ts` handles dynamic IPs nicely, but if you have a domain, set:
     ```yaml
     frontend:
       environment:
         - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
     ```
5. **Run**:
   ```bash
   sudo docker-compose up --build -d
   ```
6. **Firewall**: Ensure ports 3000 and 8000 are open in your cloud provider's firewall (Security Groups).

---

## 4. GitHub Repository Setup & Pages Deployment
Since your code is already committed locally, follow these steps to push it to GitHub:

1.  **Create a New Repo**: Go to [GitHub.com/new](https://github.com/new) and name it `Presenza-AI`.
2.  **Push Code**:
    ```bash
    git remote add origin https://github.com/<YOUR_USERNAME>/Presenza-AI.git
    git branch -M main
    git push -u origin main
    ```
3.  **Deploy to GitHub Pages**:
    - Runs `npm run deploy` (which triggers `gh-pages -d build`).
    - **IMPORTANT**: GitHub Pages handles **Static Frontend Only**. 
    - The Python Backend **will not run on GitHub**. The deployed site will look good but won't connect to the API unless you deploy the backend elsewhere (AWS, Render) and update `NEXT_PUBLIC_API_URL`.

## 5. Troubleshooting
- **Camera Black Screen**: Check if your browser is blocking "insecure" camera access. Use HTTPS or `localhost`.
- **WebSocket Fail**: Ensure your Firewall/Nginx allows WebSocket upgrades (`Connection: Upgrade`).
