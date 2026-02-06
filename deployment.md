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

## 3. SSL/HTTPS (Critical for Camera Access)
Browsers often **block camera access** on non-localhost HTTP sites. You **MUST** use HTTPS for remote access.
- **Option A (Nginx Proxy)**: Set up Nginx with Certbot (Let's Encrypt) to reverse proxy port 3000 and 8000.
- **Option B (Ngrok)**: For quick testing without a domain.
  ```bash
  ngrok http 3000
  ```

## 4. Troubleshooting
- **Camera Black Screen**: Check if your browser is blocking "insecure" camera access. Use HTTPS or `localhost`.
- **WebSocket Fail**: Ensure your Firewall/Nginx allows WebSocket upgrades (`Connection: Upgrade`).
