import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BUILD_OUTPUT_DIR || join(root,'dist'));
const env={...process.env,BUILD_OUTPUT_DIR:output,SSR_OUTPUT_DIR:resolve(process.env.SSR_OUTPUT_DIR || join(dirname(output),'quick-scan-ssr'))};
for(const [command,args] of [[join(root,'node_modules/.bin/vite'),['build']],[join(root,'node_modules/.bin/vite'),['build','--ssr','src/entry-server.jsx','--outDir',env.SSR_OUTPUT_DIR]],[process.execPath,['scripts/generate-static.mjs']]]) {
 const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit'});
 if(result.error) throw result.error;
 if(result.status!==0) process.exit(result.status || 1);
}
