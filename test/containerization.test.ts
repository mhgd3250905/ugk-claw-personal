import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();

test("container runtime files exist with the expected base configuration", () => {
	const dockerfilePath = join(projectRoot, "Dockerfile");
	const composePath = join(projectRoot, "docker-compose.yml");
	const prodComposePath = join(projectRoot, "docker-compose.prod.yml");
	const dockerignorePath = join(projectRoot, ".dockerignore");
	const envExamplePath = join(projectRoot, ".env.example");
	const nginxConfigPath = join(projectRoot, "deploy", "nginx", "default.conf");
	const packageJsonPath = join(projectRoot, "package.json");

	assert.equal(existsSync(dockerfilePath), true);
	assert.equal(existsSync(composePath), true);
	assert.equal(existsSync(prodComposePath), true);
	assert.equal(existsSync(dockerignorePath), true);
	assert.equal(existsSync(envExamplePath), true);
	assert.equal(existsSync(nginxConfigPath), true);

	const dockerfile = readFileSync(dockerfilePath, "utf8");
	assert.match(dockerfile, /FROM node:22-bookworm-slim/i);
	assert.match(dockerfile, /apt-get install -y --no-install-recommends curl ca-certificates/i);
	assert.match(dockerfile, /ENV HOST=0\.0\.0\.0/);
	assert.match(dockerfile, /ENV PORT=3000/);
	assert.match(dockerfile, /HEALTHCHECK/i);
	assert.match(dockerfile, /EXPOSE 3000/);
	assert.match(dockerfile, /CMD \["npm", "start"\]/);

	const compose = readFileSync(composePath, "utf8");
	assert.match(compose, /services:/);
	assert.match(compose, /ugk-pi:/);
	assert.match(compose, /3000:3000/);
	assert.match(compose, /HOST:\s*0\.0\.0\.0/);
	assert.match(compose, /npm run dev/);

	const prodCompose = readFileSync(prodComposePath, "utf8");
	assert.match(prodCompose, /services:/);
	assert.match(prodCompose, /ugk-pi:/);
	assert.match(prodCompose, /nginx:/);
	assert.match(prodCompose, /restart:\s*unless-stopped/);
	assert.match(prodCompose, /env_file:/);
	assert.match(prodCompose, /\.env/);
	assert.match(prodCompose, /npm start/);
	assert.match(prodCompose, /healthcheck:/);
	assert.match(prodCompose, /logs\/app/);
	assert.match(prodCompose, /logs\/nginx/);
	assert.match(prodCompose, /runtime\/skills-user/);
	assert.match(prodCompose, /default\.conf/);
	assert.match(prodCompose, /depends_on:/);

	const envExample = readFileSync(envExamplePath, "utf8");
	assert.match(envExample, /DASHSCOPE_CODING_API_KEY=/);
	assert.match(envExample, /HOST=0\.0\.0\.0/);
	assert.match(envExample, /PORT=3000/);
	assert.match(envExample, /HOST_PORT=3000/);

	const dockerignore = readFileSync(dockerignorePath, "utf8");
	assert.match(dockerignore, /node_modules/);
	assert.match(dockerignore, /\.git/);
	assert.match(dockerignore, /\.data/);

	const nginxConfig = readFileSync(nginxConfigPath, "utf8");
	assert.match(nginxConfig, /proxy_pass http:\/\/ugk-pi:3000/);
	assert.match(nginxConfig, /location \/healthz/);

	const packageJson = readFileSync(packageJsonPath, "utf8");
	assert.match(packageJson, /docker:logs:prod/);
	assert.match(packageJson, /docker:logs:nginx/);
	assert.match(packageJson, /docker:status:prod/);
	assert.match(packageJson, /docker:health:prod/);
});
