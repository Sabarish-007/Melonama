import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCcw,
  ShieldAlert,
  Info
} from 'lucide-react';

interface AnalysisResult {
  prediction: "Benign" | "Malignant";
  confidence: number;
  risk_level: "Low" | "Medium" | "High";
  abcde: {
    asymmetry: string;
    border: string;
    color: string;
    diameter: string;
    evolution: string;
  };
  summary: string;
  recommendation: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!supportedTypes.includes(file.type)) {
       setError('Please upload a valid image file (JPG, PNG, WebP, or SVG).');
       return;
    }
    
    setError(null);
    const reader = new FileReader();

    reader.onload = async (e) => {
      let resultDataUrl = e.target?.result as string;
      let finalMimeType = file.type === 'image/svg+xml' ? 'image/png' : file.type;

      // Special handling for SVG: rasterize it to PNG for the AI
      if (file.type === 'image/svg+xml') {
        try {
          resultDataUrl = await rasterizeSvg(resultDataUrl);
        } catch (err) {
          setError('Failed to process SVG. Please try a standard image format.');
          return;
        }
      }

      setImage(resultDataUrl);
      const base64 = resultDataUrl.split(',')[1];
      setBase64Image(base64);
      setMimeType(finalMimeType === 'image/svg+xml' ? 'image/png' : finalMimeType);
    };
    reader.readAsDataURL(file);
  };

  const rasterizeSvg = (svgDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Use high resolution for better analysis
        const scale = 2; 
        canvas.width = img.width * scale || 800;
        canvas.height = img.height * scale || 800;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No context');
        
        ctx.fillStyle = 'white'; // White background for SVGs with transparency
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = svgDataUrl;
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const analyzeImage = async () => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      setError('API key is not configured. Please set GROQ_API_KEY in your .env file.');
      return;
    }
    if (!base64Image) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const prompt = `You are SmartMole, a dermatology AI assistant. Analyze this skin lesion image using ABCDE dermoscopy criteria. Respond ONLY with this JSON, no markdown, no extra text:
{
  "prediction": "Benign" or "Malignant",
  "confidence": <0-100 integer>,
  "risk_level": "Low" or "Medium" or "High",
  "abcde": {
    "asymmetry": "<one sentence>",
    "border": "<one sentence>",
    "color": "<one sentence>",
    "diameter": "<one sentence>",
    "evolution": "<one sentence>"
  },
  "summary": "<2-3 sentence clinical summary>",
  "recommendation": "Routine monitoring" or "Dermatologist consultation advised" or "Urgent dermatologist consultation"
}`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      let text = data.choices[0].message.content;
      
      // Strip markdown fences if present
      text = text.replace(/```json\n?|```/g, '').trim();
      
      const parsedResult: AnalysisResult = JSON.parse(text);
      setResult(parsedResult);
    } catch (err) {
      console.error(err);
      setError('Failed to analyze image. Please ensure your API key is valid and try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setBase64Image(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col items-center text-center space-y-2">
          <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-200">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">SmartMole</h1>
          <p className="text-slate-500 max-w-md">Professional skin lesion analysis</p>
        </header>

        {/* Upload Session */}
        {!result && (
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {!image ? (
              <div 
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all"
              >
                <div className="bg-slate-100 p-4 rounded-full group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-700">Drop your lesion image here</p>
                  <p className="text-sm text-slate-400">or click to browse (JPG, PNG, WebP, SVG)</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept=".jpg,.jpeg,.png,.webp,.svg,image/*" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-lg group">
                <img src={image} alt="Uploaded lesion" className="w-full h-auto max-h-[400px] object-contain bg-slate-900" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-md hover:bg-white text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <button 
              disabled={!image || loading}
              onClick={analyzeImage}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-md ${
                !image || loading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-slate-900 text-white hover:bg-black active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                  <span>Analyzing Lesion...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Analyze Skin Lesion</span>
                </>
              )}
            </button>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-700">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </motion.section>
        )}

        {/* Results Card */}
        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden"
            >
              {/* Result Header */}
              <div className={`p-8 text-center space-y-4 ${
                result.prediction === 'Benign' ? 'bg-emerald-50/50' : 'bg-red-50/50'
              }`}>
                <div className="flex justify-between items-center mb-4">
                   <button 
                    onClick={reset}
                    className="p-2 bg-white rounded-full shadow hover:bg-slate-50 text-slate-500 transition-all"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    result.risk_level === 'Low' ? 'bg-emerald-100 text-emerald-700' :
                    result.risk_level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {result.risk_level} Risk Level
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Detection Status</p>
                  <h2 className={`text-5xl font-black ${
                    result.prediction === 'Benign' ? 'text-[#1D9E75]' : 'text-[#D85A30]'
                  }`}>
                    {result.prediction.toUpperCase()}
                  </h2>
                </div>

                <div className="max-w-xs mx-auto space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>CONFIDENCE</span>
                    <span>{result.confidence}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${
                        result.prediction === 'Benign' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Result Body */}
              <div className="p-8 space-y-8">
                {/* ABCDE Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center">
                    <Info className="w-4 h-4 mr-2 text-slate-400" />
                    ABCDE DERMOSCOPY CRITERIA
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(result.abcde).map(([key, val]) => (
                      <div key={key} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1 hover:bg-white transition-all hover:shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{key}</span>
                        <p className="text-sm text-slate-700 leading-tight">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">CLINICAL SUMMARY</h3>
                  <p className="text-slate-600 text-sm leading-relaxed leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {result.summary}
                  </p>
                </div>

                {/* Recommendation */}
                <div className={`p-4 rounded-xl flex items-center space-x-4 border overflow-hidden relative ${
                  result.prediction === 'Benign' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                }`}>
                  <div className={`p-3 rounded-lg ${
                    result.prediction === 'Benign' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}>
                    <ShieldAlert className="w-6 h-6 text-white" />
                  </div>
                  <div className="relative z-10">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      result.prediction === 'Benign' ? 'text-emerald-700' : 'text-red-700'
                    }`}>Clinical Recommendation</p>
                    <p className={`font-bold ${
                      result.prediction === 'Benign' ? 'text-emerald-900' : 'text-red-900'
                    }`}>{result.recommendation}</p>
                  </div>
                  <div className={`absolute -right-4 -bottom-4 opacity-10 ${
                    result.prediction === 'Benign' ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    <ShieldAlert className="w-24 h-24" />
                  </div>
                </div>
              </div>

              {/* Bottom Reset */}
              <div className="px-8 pb-8 flex justify-center">
                <button 
                  onClick={reset}
                  className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-bold flex items-center space-x-2 transition-all"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>Start New Analysis</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer & Disclaimer */}
        <footer className="text-center space-y-4 pt-8 border-t border-slate-200">
          <div className="flex items-center justify-center space-x-6 text-slate-300">
            <div className="w-px h-8 bg-slate-200"></div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium px-4 leading-relaxed max-w-sm mx-auto">
            <strong className="text-slate-500 uppercase mr-1">Medical Disclaimer:</strong> 
            For informational purposes only. Always consult a qualified dermatologist for a formal diagnosis. This tool is not a medical device.
          </p>
        </footer>
      </div>
    </div>
  );
}
