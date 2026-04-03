// src/utils/exportUtils.ts

/**
 * JSON配列をCSVとしてダウンロードさせる（Excel対応版）
 */
export const downloadAsCSV = (data: any[], fileName: string) => {
  if (data.length === 0) return;

  // 1. ヘッダーの抽出
  const headers = Object.keys(data[0]);

  // 2. CSV文字列の構築（カンマ区切り、値をダブルクォートで囲む）
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((fieldName) => {
          const value = row[fieldName] ?? "";
          // 値にカンマや改行が含まれる場合の対策
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");

  // 3. Excel用のBOM（Byte Order Mark）を付与して文字化けを防止
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });

  // 4. ダウンロード実行
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${fileName}_${new Date().toISOString().split("T")[0]}.csv`,
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
