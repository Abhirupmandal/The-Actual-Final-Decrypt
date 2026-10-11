import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Search,
  Table,
  Terminal,
  Binary,
  ArrowLeft,
} from 'lucide-react';
import { playCyberBlip, playSuccessChime } from '../utils/audio.ts';

interface ArtifactData {
  id: string;
  challengeTitle: string;
  fileName: string;
  mimeType: string;
  size: string;
  ext: string;
  isImage: boolean;
  isPdf: boolean;
  isText: boolean;
  isCsv: boolean;
  rawContent: string;
  viewUrl: string;
  downloadUrl: string;
}

interface StandaloneArtifactViewerProps {
  challengeId: string;
  onBack: () => void;
}

export const StandaloneArtifactViewer: React.FC<StandaloneArtifactViewerProps> = ({
  challengeId,
  onBack,
}) => {
  const [data, setData] = useState<ArtifactData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [imageFilter, setImageFilter] = useState<'normal' | 'invert' | 'grayscale' | 'contrast'>('normal');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'auto' | 'hex' | 'text'>('auto');

  useEffect(() => {
    // Whitelist this tab as active same-domain session
    try {
      localStorage.setItem('ctf_viewing_artifact_internal', Date.now().toString());
      localStorage.setItem('ctf_last_internal_tab_focus', Date.now().toString());
    } catch {}

    const interval = setInterval(() => {
      try {
        localStorage.setItem('ctf_viewing_artifact_internal', Date.now().toString());
        localStorage.setItem('ctf_last_internal_tab_focus', Date.now().toString());
      } catch {}
    }, 2000);

    fetch(`/api/challenges/${challengeId}/artifact/data`)
      .then((res) => {
        if (!res.ok) throw new Error('Artifact could not be retrieved.');
        return res.json();
      })
      .then((json: ArtifactData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load artifact.');
        setLoading(false);
      });

    return () => clearInterval(interval);
  }, [challengeId]);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.rawContent);
    setCopied(true);
    playSuccessChime();
    setTimeout(() => setCopied(false), 2500);
  };

  const hexLines = useMemo(() => {
    if (!data || !data.rawContent) return [];
    const content = data.rawContent;
    const lines: { offset: string; hex: string; ascii: string }[] = [];
    const chunkSize = 16;

    for (let i = 0; i < Math.min(content.length, 4096); i += chunkSize) {
      const slice = content.slice(i, i + chunkSize);
      const offset = i.toString(16).padStart(8, '0');
      let hexPart = '';
      let asciiPart = '';

      for (let j = 0; j < slice.length; j++) {
        const charCode = slice.charCodeAt(j);
        hexPart += charCode.toString(16).padStart(2, '0').toUpperCase() + ' ';
        if (j === 7) hexPart += ' ';
        asciiPart += charCode >= 32 && charCode <= 126 ? slice[j] : '.';
      }

      lines.push({
        offset,
        hex: hexPart.padEnd(50, ' '),
        ascii: asciiPart,
      });
    }

    return lines;
  }, [data]);

  const csvData = useMemo(() => {
    if (!data || !data.isCsv || !data.rawContent) return null;
    const rawLines = data.rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length === 0) return null;

    const delimiter = data.ext === '.tsv' ? '\t' : ',';
    const headers = rawLines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = rawLines.slice(1).map((line) =>
      line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
    );

    return { headers, rows };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#07090e] text-[#e2e8f0] flex flex-col font-mono text-xs">
      {/* Header Bar */}
      <div className="px-6 py-4 bg-[#0d121f] border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              playCyberBlip(750);
              onBack();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO CHALLENGES</span>
          </button>

          <div className="h-5 w-px bg-slate-700" />

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
              {data?.isImage ? <ImageIcon className="w-4 h-4" /> : data?.isCsv ? <Table className="w-4 h-4" /> : data?.isText ? <Terminal className="w-4 h-4" /> : <Binary className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <span>{data?.fileName || 'Loading Artifact...'}</span>
                {data && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{data.size}</span>}
              </div>
              <div className="text-slate-400 text-xs">{data?.challengeTitle} · Dedicated Same-Domain Inspection Tab</div>
            </div>
          </div>
        </div>

        {data && (
          <a
            href={data.downloadUrl}
            download={data.fileName}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD OFFLINE</span>
          </a>
        )}
      </div>

      {/* Main Inspection View */}
      <div className="flex-1 p-6 overflow-auto bg-[#04060a]">
        {loading && (
          <div className="h-64 flex flex-col items-center justify-center space-y-3 text-cyan-400">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-xs font-bold uppercase">Loading In-Browser Artifact Stream...</div>
          </div>
        )}

        {error && (
          <div className="h-64 flex flex-col items-center justify-center text-red-400">
            <div className="text-base font-bold">Failed to load artifact</div>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="h-full max-w-6xl mx-auto space-y-4">
            {data.isImage && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-2 bg-[#0c101c] border border-slate-800 rounded-xl w-fit">
                  <button onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} className="p-1.5 rounded bg-slate-800 text-white"><ZoomIn className="w-4 h-4" /></button>
                  <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} className="p-1.5 rounded bg-slate-800 text-white"><ZoomOut className="w-4 h-4" /></button>
                  <button onClick={() => setZoom(1)} className="p-1.5 rounded bg-slate-800 text-white"><RotateCcw className="w-4 h-4" /></button>
                  <span className="text-slate-400 px-1 font-mono">{Math.round(zoom * 100)}%</span>
                  <div className="h-4 w-px bg-slate-700" />
                  {(['normal', 'invert', 'grayscale', 'contrast'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setImageFilter(mode)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${imageFilter === mode ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-800 p-8 flex items-center justify-center bg-[#060911]">
                  <img
                    src={data.viewUrl}
                    alt={data.fileName}
                    style={{
                      transform: `scale(${zoom})`,
                      filter:
                        imageFilter === 'invert'
                          ? 'invert(1)'
                          : imageFilter === 'grayscale'
                          ? 'grayscale(1)'
                          : imageFilter === 'contrast'
                          ? 'contrast(2.5) saturate(1.8)'
                          : 'none',
                    }}
                    className="max-h-[75vh] object-contain shadow-2xl rounded select-none"
                  />
                </div>
              </div>
            )}

            {data.isPdf && (
              <div className="h-[80vh] rounded-xl overflow-hidden border border-slate-800">
                <iframe src={data.viewUrl} title={data.fileName} className="w-full h-full bg-slate-900" />
              </div>
            )}

            {data.isCsv && csvData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search table rows..."
                    className="bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-1.5 text-white max-w-sm"
                  />
                  <span className="text-slate-400">{csvData.rows.length} rows · {csvData.headers.length} columns</span>
                </div>

                <div className="overflow-auto max-h-[75vh] rounded-xl border border-slate-800 bg-[#090d16]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#0f1422] text-cyan-300 uppercase sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-slate-800 w-12 text-slate-500">#</th>
                        {csvData.headers.map((h, idx) => (
                          <th key={idx} className="py-2.5 px-3 border-r border-slate-800 last:border-r-0 font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {csvData.rows
                        .filter((r) => !searchQuery || r.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())))
                        .map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-cyan-950/20">
                            <td className="py-2 px-3 border-r border-slate-800 text-slate-500">{rIdx + 1}</td>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 border-r border-slate-800 last:border-r-0 truncate max-w-xs">{cell}</td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!data.isImage && !data.isPdf && !data.isCsv && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('auto')}
                      className={`px-3 py-1 rounded text-xs font-bold uppercase ${viewMode === 'auto' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Text View
                    </button>
                    <button
                      onClick={() => setViewMode('hex')}
                      className={`px-3 py-1 rounded text-xs font-bold uppercase ${viewMode === 'hex' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Hex Dump View
                    </button>
                  </div>
                  <button onClick={handleCopy} className="px-3 py-1 rounded bg-slate-800 text-cyan-400 font-bold flex items-center gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED' : 'COPY RAW'}</span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#04060a] p-4 text-xs max-h-[75vh] overflow-auto">
                  {viewMode === 'hex' ? (
                    <div className="space-y-0.5 select-text">
                      <div className="text-slate-500 text-[10px] pb-1 border-b border-slate-800">OFFSET 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F ASCII</div>
                      {hexLines.map((line, idx) => (
                        <div key={idx} className="flex gap-4 hover:bg-cyan-950/20 py-0.5 font-mono text-[11px]">
                          <span className="text-cyan-500/80">{line.offset}</span>
                          <span className="text-amber-300/90 whitespace-pre">{line.hex}</span>
                          <span className="text-emerald-400 select-text">{line.ascii}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-all text-slate-200 select-text leading-relaxed font-mono">{data.rawContent}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
