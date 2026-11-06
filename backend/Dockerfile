# Shared base: Node + Python 3 + matplotlib, so both stages can run
# scripts/render_infographic.py (infographicService spawns python3).
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    MPLCONFIGDIR=/opt/mplconfig \
    PATH="/opt/venv/bin:$PATH"
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install -r requirements.txt

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY scripts/render_infographic.py ./scripts/render_infographic.py
# Fail the image build if the renderer cannot write a PNG (also warms the font cache).
RUN echo '{"kind":"chart","type":"bar","title":"Client sales","labels":["Decrease"],"values":[70]}' \
      | python3 scripts/render_infographic.py > /tmp/smoke.png \
    && test "$(head -c 4 /tmp/smoke.png | od -An -tx1 | tr -d ' \n')" = "89504e47" \
    && rm /tmp/smoke.png
EXPOSE 5000
CMD ["node", "dist/server.js"]
