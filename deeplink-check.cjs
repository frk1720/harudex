const BASE = 'https://harudex.thegxb.workers.dev';
async function main() {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  console.log('status:', res.status);
  console.log('has potplayer://:', html.includes('potplayer://'));
  console.log('has vlc://:', html.includes('vlc://'));
  console.log('has detectPlatform:', html.includes('detectPlatform'));
  console.log('has intent:// (mx):', html.includes('intent://'));
  console.log('has stream-modal:', html.includes('stream-modal'));
}
main().catch((e) => console.error('ERROR:', e.message));