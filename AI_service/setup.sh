#!/bin/bash

set -e

echo "====================================="
echo " Setting up Filmly AI Service"
echo "====================================="

echo "[1/8] Updating Ubuntu..."
sudo apt update

echo "[2/8] Installing required packages..."
sudo apt install -y python3 python3-pip python3-venv git

echo "[3/8] Creating virtual environment..."
python3 -m venv venv

echo "[4/8] Activating virtual environment..."
source venv/bin/activate

echo "[5/8] Upgrading pip..."
pip install --upgrade pip

echo "[6/8] Installing Python packages..."
pip install -r requirements.txt

echo "[7/8] Installing systemd service..."

if [ -f ../deployment/filmly.service ]; then
    sudo cp ../deployment/filmly.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable filmly
    echo "✓ systemd service installed."
else
    echo "⚠ deployment/filmly.service not found. Skipping."
fi

echo "[8/8] Setup completed!"

echo ""
echo "====================================="
echo "IMPORTANT"
echo "====================================="
echo "1. Create a .env file in AI_service/"
echo "2. Then start the service using:"
echo ""
echo "sudo systemctl start filmly"
echo ""
echo "Check status:"
echo "sudo systemctl status filmly"
echo ""
echo "====================================="