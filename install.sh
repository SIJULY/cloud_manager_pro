#!/bin/bash

# ==============================================================================
# Cloud Manager 一键安装脚本（稳定增强版）
# ==============================================================================

INSTALL_DIR="/opt/cloud_manager"
REPO_URL="https://github.com/SIJULY/cloud_manager_pro.git"
SERVICE_NAME="cloud_manager"
CELERY_SERVICE_NAME="cloud_manager_celery"

set -e

print_info() { echo -e "\e[34m[信息]\e[0m $1"; }
print_success() { echo -e "\e[32m[成功]\e[0m $1"; }
print_warning() { echo -e "\e[33m[警告]\e[0m $1"; }
print_error() { echo -e "\e[31m[错误]\e[0m $1"; exit 1; }

# ================= 卸载 =================
uninstall_panel() {
    print_warning "确定要卸载吗？"

    read -p "输入 yes 确认: " confirmation
    confirmation=$(echo "$confirmation" | tr '[:upper:]' '[:lower:]' | xargs)

    if [[ "$confirmation" != "yes" ]]; then
        print_info "取消卸载。"
        exit 0
    fi

    print_info "正在卸载..."

    systemctl stop ${SERVICE_NAME}.service || true
    systemctl stop ${CELERY_SERVICE_NAME}.service || true

    systemctl disable ${SERVICE_NAME}.service || true
    systemctl disable ${CELERY_SERVICE_NAME}.service || true

    rm -f /etc/systemd/system/${SERVICE_NAME}.service
    rm -f /etc/systemd/system/${CELERY_SERVICE_NAME}.service

    systemctl daemon-reload

    rm -rf "${INSTALL_DIR}"

    print_success "卸载完成"
}

# ================= 安装/更新 =================
install_or_update_panel() {

    print_info "安装依赖..."
    apt-get update
    apt-get install -y git python3-venv python3-pip redis-server curl gpg python3-dev gcc

    # ===== Caddy 防重复安装 =====
    if [ ! -f /etc/apt/sources.list.d/caddy-stable.list ]; then
        print_info "安装 Caddy..."
        apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update
    fi

    apt-get install -y caddy

    # ===== 更新 or 安装 =====
    if [ -d "${INSTALL_DIR}" ]; then

        print_info "检测到已安装，执行更新..."

        systemctl stop ${SERVICE_NAME}.service || true
        systemctl stop ${CELERY_SERVICE_NAME}.service || true

        cd "${INSTALL_DIR}"

        print_info "拉取最新代码..."
        git pull origin main

    else
        print_info "全新安装..."

        git clone "${REPO_URL}" "${INSTALL_DIR}"
        cd "${INSTALL_DIR}"

        touch config.json key.txt
    fi

    # ===== Python 环境 =====
    print_info "配置 Python..."

    cd "${INSTALL_DIR}"
    python3 -m venv venv
    source venv/bin/activate

    pip install --upgrade pip
    pip install -r requirements.txt

    # ARM兼容 gevent
    pip install "gevent>=22.10.2"

    deactivate

    # ===== gunicorn socket 目录 =====
    mkdir -p /run/gunicorn
    chown -R caddy:caddy /run/gunicorn

    chown -R caddy:caddy "${INSTALL_DIR}"

    # ===== systemd =====
    print_info "配置服务..."

    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Cloud Manager
After=network.target

[Service]
User=caddy
Group=caddy
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/gunicorn --workers 3 --bind unix:/run/gunicorn/cloud_manager.sock app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    cat > /etc/systemd/system/${CELERY_SERVICE_NAME}.service << EOF
[Unit]
Description=Cloud Manager Celery
After=network.target redis-server.service

[Service]
User=caddy
Group=caddy
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/celery -A app.celery worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # ===== 启动 =====
    print_info "启动服务..."

    systemctl daemon-reload
    systemctl enable redis-server ${SERVICE_NAME} ${CELERY_SERVICE_NAME}
    systemctl restart redis-server ${SERVICE_NAME} ${CELERY_SERVICE_NAME}
    systemctl restart caddy

    print_success "安装完成！"

    echo ""
    echo "👉 查看状态:"
    echo "systemctl status cloud_manager"
    echo ""
    echo "👉 查看日志:"
    echo "journalctl -u cloud_manager -f"
}

# ================= 主菜单 =================

if [ "$(id -u)" -ne 0 ]; then
    print_error "必须使用 root 运行"
fi

clear
echo "======================================"
echo " Cloud Manager 安装脚本"
echo "======================================"
echo "1) 安装 / 更新"
echo "2) 卸载"
echo "3) 退出"
echo "======================================"

read -p "请选择 [1]: " choice
choice=${choice:-1}

case $choice in
    1) install_or_update_panel ;;
    2) uninstall_panel ;;
    3) exit 0 ;;
    *) print_error "无效选项" ;;
esac
