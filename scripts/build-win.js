const fs = require('fs-extra');
const path = require('path');
const asar = require('@electron/asar');
const resedit = require('resedit');

async function build() {
  const rootDir = path.resolve(__dirname, '..');
  const outDir = path.join(rootDir, 'release', 'win-unpacked');
  const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
  const appTarget = path.join(outDir, 'resources', 'app');
  const iconPath = path.join(rootDir, 'build', 'icon.ico');

  console.log('1. Preparing release folder at:', outDir);
  await fs.remove(outDir);
  await fs.ensureDir(outDir);

  console.log('2. Copying Electron binary runtime...');
  await fs.copy(electronDist, outDir);

  const exePath = path.join(outDir, 'JARVIS.exe');
  await fs.rename(path.join(outDir, 'electron.exe'), exePath);

  console.log('3. Assembling application resources...');
  await fs.ensureDir(appTarget);
  await fs.copy(path.join(rootDir, 'dist'), path.join(appTarget, 'dist'));
  await fs.copy(path.join(rootDir, 'dist-electron'), path.join(appTarget, 'dist-electron'));
  await fs.copy(path.join(rootDir, 'package.json'), path.join(appTarget, 'package.json'));
  await fs.copy(path.join(rootDir, 'build'), path.join(appTarget, 'build'));
  
  if (await fs.pathExists(path.join(rootDir, '.env'))) {
    await fs.copy(path.join(rootDir, '.env'), path.join(appTarget, '.env'));
    // Also place .env next to the exe for easy access
    await fs.copy(path.join(rootDir, '.env'), path.join(outDir, '.env'));
  }

  // Copy runtime node_modules
  const targetModules = path.join(appTarget, 'node_modules');
  await fs.ensureDir(targetModules);
  await fs.copy(path.join(rootDir, 'node_modules', 'dotenv'), path.join(targetModules, 'dotenv'));
  await fs.copy(path.join(rootDir, 'node_modules', 'systeminformation'), path.join(targetModules, 'systeminformation'));

  console.log('4. Embedding icon and metadata via ResEdit...');
  try {
    const data = await fs.readFile(exePath);
    const exe = resedit.NtExecutable.from(data);
    const res = resedit.NtExecutableResource.from(exe);

    if (await fs.pathExists(iconPath)) {
      const iconFile = resedit.Data.IconFile.from(await fs.readFile(iconPath));
      resedit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconFile.icons.map(item => item.data)
      );
    }

    const viList = resedit.Resource.VersionInfo.fromEntries(res.entries);
    const vi = viList.length > 0 ? viList[0] : resedit.Resource.VersionInfo.createEmpty();
    vi.setFileVersion(1, 0, 0, 0, 1033);
    vi.setProductVersion(1, 0, 0, 0, 1033);
    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        FileDescription: 'J.A.R.V.I.S. Floating System Overlay',
        ProductName: 'JARVIS Overlay',
        CompanyName: 'J.A.R.V.I.S. Systems',
        LegalCopyright: 'Copyright © 2026',
        OriginalFilename: 'JARVIS.exe',
      }
    );
    vi.outputToResourceEntries(res.entries);
    res.outputResource(exe);
    await fs.writeFile(exePath, Buffer.from(exe.generate()));
    console.log('-> Successfully patched icon and version metadata into JARVIS.exe!');
  } catch (err) {
    console.warn('-> Warning while patching metadata (exe is still fully functional):', err.message);
  }

  console.log('\nSUCCESS! Windows application created at:');
  console.log(exePath);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
