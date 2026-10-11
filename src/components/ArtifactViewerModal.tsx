import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Copy,
  Check,
  Search,
  Maximize2,
  Table,
  Terminal,
  Binary,
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

interface ArtifactViewerModalProps {
  challengeId: string | null;
  onClose: () => void;
}

export const ArtifactViewerModal: React.FC<ArtifactViewerModalProps> = ({
  challengeId,
  onClose,
}) => {
  const [data, setData] = useState<ArtifactData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Image manipulation controls
  const [zoom, setZoom] = useState<number>(1);
  const [imageFilter, setImageFilter] = useState<'normal' | 'invert' | 'grayscale' | 'contrast'>('normal');

  // Text & Search controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'auto' | 'hex' | 'text'>('auto');

  useEffect(() => {
    if (!challengeId) return;

    // Mark that the participant is viewing an internal artifact (Whitelists same-domain tab activity)
    try {
      localStorage.setItem('ctf_viewing_artifact_internal', Date.now().toString());
    } catch {}

    const interval = setInterval(() => {
      try {
        localStorage.setItem('ctf_viewing_artifact_internal', Date.now().toString());
      } catch {}
    }, 2000);

    setLoading(true);
    setError(null);
    setZoom(1);
    setImageFilter('normal');
    setSearchQuery('');
    setViewMode('auto');

    const teamToken = sessionStorage.getItem('ctf_team_token') || localStorage.getItem('ctf_team_token');
    fetch(`/api/challenges/${challengeId}/artifact/data`, {
      headers: teamToken ? { Authorization: `Bearer ${teamToken}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Artifact not available or access denied.');
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

    return () => {
      clearInterval(interval);
      // Clear artifact view lock on close after 5 seconds grace period
      setTimeout(() => {
        try {
          localStorage.removeItem('ctf_viewing_artifact_internal');
        } catch {}
      }, 5000);
    };
  }, [challengeId]);

  // Copy raw content
  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.rawContent);
    setCopied(true);
    playSuccessChime();
    setTimeout(() => setCopied(false), 2500);
  };

  // Open in Standalone Same-Domain Viewer Tab
  const handleOpenInNewTab = () => {
    if (!challengeId) return;
    playCyberBlip(800);
    try {
      // Whitelist cross-tab session so the new tab is instantly recognized as an internal session
      localStorage.setItem('ctf_viewing_artifact_internal', Date.now().toString());
      localStorage.setItem('ctf_last_internal_tab_focus', Date.now().toString());
    } catch {}
    window.open(`/viewer/${challengeId}`, '_blank');
  };

  // Hex Dump Formatter for Raw / Binary files
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
        // Printable ASCII
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

  // CSV Table Parser
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

  if (!challengeId) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[90vh] bg-[#090d16] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden font-mono text-xs drm-screen-shield">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-[#0d121f] border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
              {data?.isImage ? (
                <ImageIcon className="w-4 h-4" />
              ) : data?.isCsv ? (
                <Table className="w-4 h-4" />
              ) : data?.isText ? (
                <Terminal className="w-4 h-4" />
              ) : (
                <Binary className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm truncate">{data?.fileName || 'Loading Artifact...'}</span>
                {data && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold shrink-0">
                    {data.size}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {data?.challengeTitle || 'Interactive In-Browser Artifact Display'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {data && (
              <>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open in same-domain tab (Whitelisted: Zero focus lost warnings)"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">OPEN IN VIEWER TAB</span>
                </button>

                <a
                  href={data.downloadUrl}
                  download={data.fileName}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download offline copy for local toolsets"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">DOWNLOAD FILE</span>
                </a>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              aria-label="Close Artifact Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#060911] relative">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center space-y-3 text-cyan-400">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-bold uppercase tracking-wider">Loading Artifact Stream...</div>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center text-red-400 space-y-2">
              <div className="text-base font-bold">Failed to Load Artifact</div>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* 1. IMAGE DISPLAY SYSTEM */}
              {data.isImage && (
                <div className="h-full flex flex-col items-center justify-between space-y-4">
                  {/* Image Toolbar */}
                  <div className="flex items-center gap-3 p-2 bg-[#0c101c] border border-slate-800 rounded-xl">
                    <button
                      onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setZoom(1)}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] text-slate-400 px-1 font-mono">{Math.round(zoom * 100)}%</span>

                    <div className="h-4 w-px bg-slate-700 mx-1" />

                    {/* Stego & Forensics Contrast Filters */}
                    {(['normal', 'invert', 'grayscale', 'contrast'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setImageFilter(mode)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                          imageFilter === mode
                            ? 'bg-cyan-500 text-black shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Rendered Image Canvas */}
                  <div className="flex-1 w-full flex items-center justify-center overflow-auto rounded-xl border border-slate-800/80 bg-[#04060a] p-4">
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
                        transition: 'transform 0.15s ease',
                      }}
                      className="max-h-[60vh] object-contain rounded select-none shadow-2xl"
                    />
                  </div>
                </div>
              )}

              {/* 2. PDF EMBEDDED DISPLAY */}
              {data.isPdf && (
                <div className="h-full w-full rounded-xl overflow-hidden border border-slate-800">
                  <iframe
                    src={data.viewUrl}
                    title={data.fileName}
                    className="w-full h-full bg-slate-900"
                  />
                </div>
              )}

              {/* 3. CSV / SPREADSHEET INTERACTIVE TABLE */}
              {data.isCsv && csvData && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search rows or cells..."
                        className="w-full bg-[#0c101c] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {csvData.rows.length} rows · {csvData.headers.length} columns
                    </span>
                  </div>

                  <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-[#090d16]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#0f1422] text-cyan-300 uppercase sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 border-r border-slate-800 text-[10px] w-12 text-slate-500">#</th>
                          {csvData.headers.map((h, idx) => (
                            <th key={idx} className="py-2.5 px-3 border-r border-slate-800 last:border-r-0 font-bold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                        {csvData.rows
                          .filter((row) =>
                            searchQuery
                              ? row.some((cell) => cell.toLowerCase().includes(searchQuery.toLowerCase()))
                              : true
                          )
                          .map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-cyan-950/20 transition-colors">
                              <td className="py-2 px-3 border-r border-slate-800 text-[10px] text-slate-500">
                                {rIdx + 1}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="py-2 px-3 border-r border-slate-800 last:border-r-0 truncate max-w-xs">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. TEXT / CODE VIEWER & HEX DUMP */}
              {(!data.isImage && !data.isPdf && !data.isCsv) && (
                <div className="h-full flex flex-col space-y-3">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewMode('auto')}
                        className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${
                          viewMode === 'auto'
                            ? 'bg-cyan-500 text-black shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Text View
                      </button>
                      <button
                        onClick={() => setViewMode('hex')}
                        className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${
                          viewMode === 'hex'
                            ? 'bg-cyan-500 text-black shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Hex Dump View
                      </button>
                    </div>

                    <button
                      onClick={handleCopy}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY RAW CONTENT'}</span>
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-[#04060a] p-4 font-mono text-xs text-slate-300">
                    {viewMode === 'hex' ? (
                      <div className="space-y-0.5 select-text">
                        <div className="text-slate-500 text-[10px] pb-1 border-b border-slate-800">
                          OFFSET    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  ASCII
                        </div>
                        {hexLines.map((line, idx) => (
                          <div key={idx} className="flex gap-4 hover:bg-cyan-950/20 py-0.5 font-mono text-[11px]">
                            <span className="text-cyan-500/80">{line.offset}</span>
                            <span className="text-amber-300/90 whitespace-pre">{line.hex}</span>
                            <span className="text-emerald-400 select-text">{line.ascii}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap break-all text-slate-200 select-text leading-relaxed">
                        {data.rawContent}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-2.5 bg-[#0a0e1a] border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SESSION VALIDATED · IN-BROWSER INSPECTION ACTIVE</span>
          </div>
          <span className="text-slate-500">Press ESC or click ✕ to return to challenge console</span>
        </div>
      </div>
    </div>
  );
};
