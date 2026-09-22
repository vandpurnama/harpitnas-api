/**
 * Script sederhana untuk menguji algoritma hari kecepit
 * terhadap data real dari GitHub (termasuk cross-year).
 *
 * Jalankan: npm run test:kecepit
 * Atau:     npx ts-node --transpile-only scripts/test-kecepit.ts [tahun]
 */
import { getYearData, getYearDataOptional } from '../src/services/github';
import { hitungHariKecepit } from '../src/services/kecepit';

async function main() {
  const year = Number(process.argv[2]) || 2026;

  console.log(`\n🔍 Mengambil data tahun ${year} (+ tetangga untuk cross-year)...`);

  const [yearData, prevYearData, nextYearData] = await Promise.all([
    getYearData(year),
    getYearDataOptional(year - 1),
    getYearDataOptional(year + 1),
  ]);

  console.log(`   National holidays : ${yearData.total_national}`);
  console.log(`   Joint leave       : ${yearData.total_joint_leave}`);
  console.log(`   Prev year data    : ${prevYearData ? 'ada' : 'tidak ada'}`);
  console.log(`   Next year data    : ${nextYearData ? 'ada' : 'tidak ada'}`);

  const kecepit = hitungHariKecepit(
    yearData,
    undefined,
    prevYearData,
    nextYearData
  );

  console.log(`\n📅 Total hari kecepit: ${kecepit.length}\n`);

  if (kecepit.length === 0) {
    console.log('Tidak ada hari kecepit ditemukan.');
    return;
  }

  console.table(
    kecepit.map((k) => ({
      Tanggal: k.date,
      Hari: k.day,
      'Penyebab Kiri': k.prevNonWorking,
      'Penyebab Kanan': k.nextNonWorking,
    }))
  );
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
