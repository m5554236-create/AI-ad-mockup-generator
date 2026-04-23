import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Image as ImageIcon, PenTool, Undo, Trash2, Wand2, Download, AlertCircle, CheckCircle2, RotateCcw, MapPin, Database, Server } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

type Point = { x: number, y: number };

function PolygonEditor({
  imageUrl,
  points,
  setPoints,
  isClosed,
  setIsClosed
}: {
  imageUrl: string;
  points: Point[];
  setPoints: (p: Point[]) => void;
  isClosed: boolean;
  setIsClosed: (c: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (imageRef.current && canvasRef.current) {
        const { width, height } = imageRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        setCanvasSize({ width, height });
      }
    };

    const observer = new ResizeObserver(updateSize);
    if (imageRef.current) {
      observer.observe(imageRef.current);
    }
    window.addEventListener('resize', updateSize);
    
    if (imageRef.current?.complete) {
      updateSize();
    } else if (imageRef.current) {
      imageRef.current.onload = updateSize;
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [imageUrl]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current || canvasSize.width === 0) return;

    const { width, height } = canvasRef.current;
    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x * width, points[0].y * height);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * width, points[i].y * height);
    }

    if (isClosed) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      if (mousePos) {
        ctx.lineTo(mousePos.x * width, mousePos.y * height);
      }
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2);
      
      if (i === 0 && points.length >= 3 && !isClosed) {
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }
    });
  }, [points, isClosed, mousePos, canvasSize]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isClosed) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (points.length >= 3) {
      const firstPoint = points[0];
      const dx = x - firstPoint.x;
      const dy = y - firstPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pixelDistance = distance * Math.max(rect.width, rect.height);
      if (pixelDistance < 20) {
        setIsClosed(true);
        setMousePos(null);
        return;
      }
    }

    setPoints([...points, { x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isClosed) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <div className="relative inline-block max-w-full overflow-hidden rounded-lg border border-white/10 bg-black/40 shadow-2xl">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Background"
        className="block max-w-full max-h-[60vh] w-auto h-auto"
      />
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`absolute top-0 left-0 w-full h-full ${!isClosed ? 'cursor-crosshair' : 'cursor-default'}`}
      />
    </div>
  );
}

const resizeImage = (base64Str: string, maxWidth = 2048): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      if (Math.max(width, height) > maxWidth) {
        const ratio = maxWidth / Math.max(width, height);
        width *= ratio;
        height *= ratio;
      } else {
        resolve(base64Str);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = base64Str;
  });
};

const prepareBrandImage = (brandBase64: string, points: Point[], bgWidth: number, bgHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      const maxY = Math.max(...points.map(p => p.y));
      
      const polyWidth = (maxX - minX) * bgWidth;
      const polyHeight = (maxY - minY) * bgHeight;
      
      if (polyWidth <= 0 || polyHeight <= 0) {
        resolve(brandBase64);
        return;
      }

      const targetAspect = polyWidth / polyHeight;
      const imgAspect = img.width / img.height;
      
      let canvasWidth, canvasHeight;
      
      if (imgAspect > targetAspect) {
        canvasWidth = img.width;
        canvasHeight = img.width / targetAspect;
      } else {
        canvasHeight = img.height;
        canvasWidth = img.height * targetAspect;
      }
      
      const MAX_DIM = 2048;
      if (Math.max(canvasWidth, canvasHeight) > MAX_DIM) {
        const ratio = MAX_DIM / Math.max(canvasWidth, canvasHeight);
        canvasWidth *= ratio;
        canvasHeight *= ratio;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get 2d context"));
        return;
      }
      
      // Draw blurred background to fill empty space
      ctx.filter = 'blur(40px)';
      ctx.drawImage(img, -canvasWidth * 0.1, -canvasHeight * 0.1, canvasWidth * 1.2, canvasHeight * 1.2);
      ctx.filter = 'none';
      
      // Darken the blurred background slightly so the main image pops
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Calculate dimensions to fit the image (contain)
      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let offsetX = 0;
      let offsetY = 0;
      
      if (imgAspect > targetAspect) {
        drawHeight = canvasWidth / imgAspect;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        drawWidth = canvasHeight * imgAspect;
        offsetX = (canvasWidth - drawWidth) / 2;
      }
      
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error("Failed to load brand image for preparation"));
    img.src = brandBase64;
  });
};

// Database mock using local storage
type PlacementsDB = {
  id: string;
  region: 'North' | 'Central' | 'South';
  locationName: string;
  imageUrl: string;
};

export default function App() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [brandImage, setBrandImage] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [isDraggingBrand, setIsDraggingBrand] = useState(false);

  const [activeTab, setActiveTab] = useState('ad-mockup');

  const [creativePrompt, setCreativePrompt] = useState<string>('');
  const [creativeReference, setCreativeReference] = useState<string | null>(null);
  const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
  const [creativeResult, setCreativeResult] = useState<string | null>(null);
  const [creativeError, setCreativeError] = useState<string | null>(null);
  const [isDraggingCreative, setIsDraggingCreative] = useState(false);

  // Database State
  const [placements, setPlacements] = useState<PlacementsDB[]>(() => {
    const saved = localStorage.getItem('adPlacementsDB');
    return saved ? JSON.parse(saved) : [
        { id: '1', region: 'North', locationName: 'Taipei Main Station Billboard', imageUrl: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80' },
        { id: '2', region: 'South', locationName: 'Kaohsiung Arena Screens', imageUrl: 'https://images.unsplash.com/photo-1548504771-331cba37ecae?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80' }
    ];
  });
  const [showDbDialog, setShowDbDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveRegion, setSaveRegion] = useState<string>('North');
  const [saveLocation, setSaveLocation] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');

  // Sync DB to local storage
  useEffect(() => {
    localStorage.setItem('adPlacementsDB', JSON.stringify(placements));
  }, [placements]);

  const handleSaveToDb = () => {
    if (!bgImage || !saveLocation.trim()) return;
    
    const newPlacement: PlacementsDB = {
      id: Date.now().toString(),
      region: saveRegion as any,
      locationName: saveLocation,
      imageUrl: bgImage
    };
    
    setPlacements(prev => [newPlacement, ...prev]);
    setShowSaveDialog(false);
    setSaveLocation('');
  };

  const processCreativeFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCreativeReference(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreativeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCreativeFile(file);
  };

  const handleGenerateCreative = async () => {
    if (!creativePrompt.trim()) return;
    
    setIsGeneratingCreative(true);
    setCreativeError(null);
    setCreativeResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let parts: any[] = [{ text: creativePrompt }];

      if (creativeReference) {
        const mimeType = creativeReference.split(';')[0].split(':')[1];
        const data = creativeReference.split(',')[1];
        parts.push({
          inlineData: { data, mimeType }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts
        }
      });

      let resultUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          resultUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (resultUrl) {
        setCreativeResult(resultUrl);
      } else {
        setCreativeError("No image was generated. Please try a different prompt.");
      }
    } catch (err: any) {
      console.error(err);
      setCreativeError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingCreative(false);
    }
  };

  const handleSendToMockup = () => {
    if (creativeResult) {
      setBrandImage(creativeResult);
      setActiveTab('ad-mockup');
    }
  };

  const handleCreativeDownload = () => {
    if (!creativeResult) return;
    const a = document.createElement('a');
    a.href = creativeResult;
    a.download = 'creative-result.jpg';
    a.click();
  };

  const processBgFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBgImage(event.target?.result as string);
      setPoints([]);
      setIsClosed(false);
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  };

  const processBrandFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBrandImage(event.target?.result as string);
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processBgFile(file);
  };

  const handleBrandUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processBrandFile(file);
  };

  const handleReset = () => {
    setBgImage(null);
    setBrandImage(null);
    setPoints([]);
    setIsClosed(false);
    setResultImage(null);
    setError(null);
    setCreativePrompt('');
    setCreativeReference(null);
    setCreativeResult(null);
    setCreativeError(null);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (!bgImage) {
              processBgFile(file);
            } else {
              processBrandFile(file);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [bgImage]);

  const undoPoint = () => {
    if (isClosed) {
      setIsClosed(false);
    } else {
      setPoints(points.slice(0, -1));
    }
  };

  const clearPolygon = () => {
    setPoints([]);
    setIsClosed(false);
  };

  const generateMaskedImage = async (): Promise<{ base64: string, origW: number, origH: number, padSize: number }> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        const MAX_DIMENSION = 2048;
        if (Math.max(width, height) > MAX_DIMENSION) {
          const ratio = MAX_DIMENSION / Math.max(width, height);
          width *= ratio;
          height *= ratio;
        }

        const size = Math.max(width, height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get 2d context"));
          return;
        }

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);

        const startX = (size - width) / 2;
        const startY = (size - height) / 2;
        ctx.drawImage(img, startX, startY, width, height);

        if (points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(startX + points[0].x * width, startY + points[0].y * height);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(startX + points[i].x * width, startY + points[i].y * height);
          }
          ctx.closePath();
          ctx.fillStyle = '#00FF00';
          ctx.fill();
        }

        resolve({
          base64: canvas.toDataURL('image/jpeg', 0.9),
          origW: width,
          origH: height,
          padSize: size
        });
      };
      img.onerror = () => reject(new Error("Failed to load background image for masking"));
      img.src = bgImage!;
    });
  };

  const handleGenerate = async () => {
    if (!bgImage || !brandImage || !isClosed) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = reject;
        bgImg.src = bgImage!;
      });

      const maskedResult = await generateMaskedImage();
      const maskedBgBase64 = maskedResult.base64;
      const processedBrandBase64 = await prepareBrandImage(brandImage, points, bgImg.naturalWidth, bgImg.naturalHeight);
      
      const bgData = maskedBgBase64.split(',')[1];
      const brandData = processedBrandBase64.split(',')[1];
      const bgMimeType = maskedBgBase64.split(';')[0].split(':')[1];
      const brandMimeType = processedBrandBase64.split(';')[0].split(':')[1];

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `You are an expert graphic designer and photo editor.
I have provided two images:
1. A background image with a bright green (#00FF00) polygon indicating an advertisement space.
2. A brand key visual (advertisement content).

CRITICAL INSTRUCTIONS:
- The second image has ALREADY been pre-formatted and padded to perfectly match the aspect ratio of the green polygon.
- Your task is to simply warp and map the ENTIRE second image directly into the green polygon area.
- DO NOT crop the second image. The entire contents of the second image must be visible inside the ad space.
- Apply appropriate perspective, lighting, and shadows so the advertisement looks like it naturally belongs in the physical environment.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: bgData, mimeType: bgMimeType } },
            { inlineData: { data: brandData, mimeType: brandMimeType } },
            { text: prompt }
          ]
        }
      });

      console.log("Full AI Response:", JSON.stringify(response, null, 2));

      let resultUrl = null;
      let responseText = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          resultUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        } else if (part.text) {
          responseText += part.text;
        }
      }

      const cropGeneratedImage = (
        generatedBase64: string,
        originalWidth: number,
        originalHeight: number,
        paddedSize: number
      ): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const scale = img.width / paddedSize;
            
            const targetWidth = originalWidth * scale;
            const targetHeight = originalHeight * scale;
            const startX = ((paddedSize - originalWidth) / 2) * scale;
            const startY = ((paddedSize - originalHeight) / 2) * scale;
            
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("No 2d context"));
            
            ctx.drawImage(img, startX, startY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
          img.onerror = () => reject(new Error("Failed to load generated image for cropping"));
          img.src = generatedBase64;
        });
      };

      if (resultUrl) {
        const croppedResult = await cropGeneratedImage(resultUrl, maskedResult.origW, maskedResult.origH, maskedResult.padSize);
        setResultImage(croppedResult);
      } else {
        console.error("AI Response Text:", responseText);
        setError(`Failed to generate image. The AI returned: ${responseText || 'No image or text'}`);
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = 'mockup-result.jpg';
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans pb-20 relative overflow-hidden">
      {/* Atmospheric Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />

      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 relative z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Wand2 className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              AI Ad Mockup Generator
            </h1>
          </div>
          <div className="flex items-center gap-2">
            
            <Dialog open={showDbDialog} onOpenChange={setShowDbDialog}>
              <DialogTrigger className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20">
                <Database className="w-4 h-4" /> Component Library
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border border-white/10 text-white max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-xl">Saved Placements Library</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Browse and reuse previously saved ad placements from the community.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-4 py-4">
                   <div className="flex items-center gap-2 w-full max-w-xs">
                     <MapPin className="w-4 h-4 text-zinc-400" />
                     <Select value={filterRegion} onValueChange={setFilterRegion}>
                      <SelectTrigger className="w-full bg-black/40 border-white/10 text-white">
                        <SelectValue placeholder="Filter by region" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="all">All Regions</SelectItem>
                        <SelectItem value="North">North Region</SelectItem>
                        <SelectItem value="Central">Central Region</SelectItem>
                        <SelectItem value="South">South Region</SelectItem>
                      </SelectContent>
                    </Select>
                   </div>
                </div>
                <ScrollArea className="flex-1 -mx-6 px-6">
                  {placements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                      <Server className="w-12 h-12 mb-4 opacity-50" />
                      <p>No placements saved yet.</p>
                      <p className="text-sm">Upload an image and click "Save to Library" to add one.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                      {placements
                        .filter(p => filterRegion === 'all' || p.region === filterRegion)
                        .map(placement => (
                        <div key={placement.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group hover:border-blue-500/50 transition-colors">
                          <div className="aspect-video relative overflow-hidden bg-black/40">
                            <img src={placement.imageUrl} alt={placement.locationName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-medium text-white flex items-center gap-1 border border-white/10">
                              <MapPin className="w-3 h-3 text-blue-400" />
                              {placement.region}
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-medium text-zinc-200 truncate" title={placement.locationName}>{placement.locationName}</h3>
                            <button
                              onClick={() => {
                                setBgImage(placement.imageUrl);
                                setPoints([]);
                                setIsClosed(false);
                                setShowDbDialog(false);
                                setActiveTab('ad-mockup');
                              }}
                              className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              Use this Placement
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
            >
              <RotateCcw className="w-4 h-4" /> Start Over
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 mt-4 relative z-10 w-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-black/40 border border-white/10 p-1 mb-8 rounded-xl flex w-fit mx-auto backdrop-blur-md">
            <TabsTrigger 
              value="ad-mockup" 
              className="rounded-lg px-6 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 transition-all font-medium"
            >
              AI Ad Mockup Generator
            </TabsTrigger>
            <TabsTrigger 
              value="creative-creator" 
              className="rounded-lg px-6 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-zinc-400 transition-all font-medium"
            >
              AI Creative Creator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ad-mockup" className="space-y-8 mt-0 border-0 p-0 outline-none">
        {/* Step 1: Background & Polygon */}
        <section className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative transition-all duration-500 hover:bg-white/[0.07] hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <h2 className="text-lg font-medium flex items-center gap-3 text-white">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/30">1</span>
              Upload Background & Select Area
            </h2>
            <p className="text-zinc-400 text-sm mt-2 ml-10">
              Upload a photo of the outdoor ad space, then use the pen tool to outline where the ad should go.
            </p>
          </div>
          
          <div className="p-6">
            {!bgImage ? (
              <label 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBg(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingBg(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDraggingBg(false); const file = e.dataTransfer.files?.[0]; if (file) processBgFile(file); }}
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${isDraggingBg ? 'border-blue-400 bg-blue-500/10' : 'border-white/20 bg-black/20 hover:bg-white/5 hover:border-white/30'}`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                  <Upload className={`w-10 h-10 mb-3 transition-colors ${isDraggingBg ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <p className="mb-2 text-sm text-zinc-300"><span className="font-semibold text-white">Click to upload</span>, drag and drop, or paste</p>
                  <p className="text-xs text-zinc-500">PNG, JPG up to 10MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-300 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
                    <PenTool className="w-4 h-4 text-blue-400" />
                    {isClosed ? (
                      <span className="text-green-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Area selected
                      </span>
                    ) : (
                      <span>Click to add points. Click the first point to close.</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {points.length >= 3 && !isClosed && (
                      <button 
                        onClick={() => setIsClosed(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-md hover:bg-green-500/20 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Close Shape
                      </button>
                    )}
                    <button 
                      onClick={undoPoint} 
                      disabled={points.length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-300 bg-white/5 border border-white/10 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Undo className="w-4 h-4" /> Undo
                    </button>
                    <button 
                      onClick={clearPolygon}
                      disabled={points.length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Clear
                    </button>
                    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                      <DialogTrigger
                        disabled={!bgImage}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Database className="w-4 h-4" /> Save to Library
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-950 border border-white/10 text-white">
                        <DialogHeader>
                          <DialogTitle>Save to Component Library</DialogTitle>
                          <DialogDescription className="text-zinc-400">
                            Add this placement image to your shared library.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Region</label>
                            <Select value={saveRegion} onValueChange={setSaveRegion}>
                              <SelectTrigger className="w-full bg-black/40 border-white/10 text-white">
                                <SelectValue placeholder="Select region" />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                <SelectItem value="North">North Region</SelectItem>
                                <SelectItem value="Central">Central Region</SelectItem>
                                <SelectItem value="South">South Region</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Location Name</label>
                            <input 
                              type="text" 
                              value={saveLocation} 
                              onChange={(e) => setSaveLocation(e.target.value)} 
                              placeholder="e.g. Taipei 101 Substation" 
                              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <button 
                            onClick={handleSaveToDb}
                            disabled={!saveLocation.trim()}
                            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
                          >
                            Save Placement
                          </button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <label className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20 cursor-pointer transition-colors">
                      <ImageIcon className="w-4 h-4" /> Change Image
                      <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-center bg-black/40 rounded-xl border border-white/10 p-2 sm:p-4 backdrop-blur-sm">
                  <PolygonEditor 
                    imageUrl={bgImage} 
                    points={points} 
                    setPoints={setPoints} 
                    isClosed={isClosed} 
                    setIsClosed={setIsClosed} 
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Brand Image */}
        <section className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative transition-all duration-500 hover:bg-white/[0.07] hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
          <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center group">
            <div>
              <h2 className="text-lg font-medium flex items-center gap-3 text-white">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/30">2</span>
                Upload Brand Visual
              </h2>
              <p className="text-zinc-400 text-sm mt-2 ml-10">
                Upload the advertisement design you want to place in the selected area.
              </p>
            </div>
            {brandImage && (
              <button
                onClick={() => setBrandImage(null)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> Clear Image
              </button>
            )}
          </div>
          
          <div className="p-6">
            {!brandImage ? (
              <label 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBrand(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingBrand(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDraggingBrand(false); const file = e.dataTransfer.files?.[0]; if (file) processBrandFile(file); }}
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${isDraggingBrand ? 'border-blue-400 bg-blue-500/10' : 'border-white/20 bg-black/20 hover:bg-white/5 hover:border-white/30'}`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                  <Upload className={`w-8 h-8 mb-3 transition-colors ${isDraggingBrand ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <p className="mb-2 text-sm text-zinc-300"><span className="font-semibold text-white">Click to upload</span>, drag and drop, or paste</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleBrandUpload} />
              </label>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-full sm:w-1/3">
                  <img src={brandImage} alt="Brand Visual" className="w-full h-auto rounded-lg border border-white/10 shadow-2xl" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2 text-green-400 font-medium bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20 inline-flex backdrop-blur-md">
                    <CheckCircle2 className="w-5 h-5" />
                    Brand visual ready
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
                      <ImageIcon className="w-4 h-4" /> Replace Image
                      <input type="file" className="hidden" accept="image/*" onChange={handleBrandUpload} />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 3: Generate */}
        <section className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative transition-all duration-500 hover:bg-white/[0.07] hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
          <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center group">
            <h2 className="text-lg font-medium flex items-center gap-3 text-white">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/30">3</span>
              Generate Mockup
            </h2>
            {resultImage && (
              <button
                onClick={() => setResultImage(null)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> Clear Result
              </button>
            )}
          </div>
          
          <div className="p-6 flex flex-col items-center">
            {error && (
              <div className="w-full mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 backdrop-blur-md">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!bgImage || !brandImage || !isClosed || isGenerating}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-zinc-500 disabled:border-white/10 disabled:shadow-none border border-blue-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300 flex items-center justify-center gap-2 text-lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating AI Mockup...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate Mockup
                </>
              )}
            </button>

            {(!bgImage || !brandImage || !isClosed) && !resultImage && (
              <p className="mt-4 text-sm text-zinc-500 text-center">
                Please complete steps 1 and 2 to enable generation.
              </p>
            )}

            {resultImage && (
              <div className="mt-8 w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Final Result</h3>
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
                <img src={resultImage} alt="Generated Mockup" className="w-full h-auto rounded-xl border border-white/10 shadow-2xl" />
                <div className="flex justify-center pt-4">
                  <button 
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 px-8 py-4 w-full sm:w-auto text-lg font-semibold text-white bg-green-600 border border-green-500 rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.4)] hover:shadow-[0_0_30px_rgba(22,163,74,0.6)] hover:bg-green-500 transition-all duration-300"
                  >
                    <Download className="w-6 h-6" /> Download Result Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        </TabsContent>
        <TabsContent value="creative-creator" className="mt-0 border-0 p-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative transition-all duration-500 hover:bg-white/[0.07] hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
              <div className="p-6 border-b border-white/10 bg-white/5">
                <h2 className="text-lg font-medium flex items-center gap-3 text-white">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold border border-purple-500/30">1</span>
                  Design Inspiration
                </h2>
                <p className="text-zinc-400 text-sm mt-2 ml-10">
                  Provide text prompts or upload existing assets to guide the AI in generating a new advertisement creative.
                </p>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-zinc-300 mb-2">Describe Your Vision</label>
                  <textarea 
                    id="prompt" 
                    rows={4} 
                    value={creativePrompt}
                    onChange={(e) => setCreativePrompt(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
                    placeholder="e.g., A futuristic cyberpunk pair of sneakers glowing in the dark, high quality, 4k render..."
                  ></textarea>
                </div>
                
                <div>
                   <label className="block text-sm font-medium text-zinc-300 mb-2">Upload Reference Image (Optional)</label>
                   {!creativeReference ? (
                    <label 
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingCreative(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDraggingCreative(false); }}
                      onDrop={(e) => { e.preventDefault(); setIsDraggingCreative(false); const file = e.dataTransfer.files?.[0]; if (file) processCreativeFile(file); }}
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${isDraggingCreative ? 'border-purple-400 bg-purple-500/10' : 'border-white/20 bg-black/20 hover:bg-white/5 hover:border-white/30'}`}
                    >
                      <div className="flex flex-col items-center justify-center pointer-events-none">
                        <Upload className={`w-8 h-8 mb-2 ${isDraggingCreative ? 'text-purple-400' : 'text-zinc-400'} transition-colors`} />
                        <p className="text-xs text-zinc-400 text-center"><span className="font-semibold text-white">Click to upload</span> or drag and drop</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleCreativeUpload} />
                    </label>
                   ) : (
                     <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/10">
                        <img src={creativeReference} alt="Reference" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-300">Reference attached</p>
                          <button 
                            onClick={() => setCreativeReference(null)}
                            className="text-xs text-red-400 hover:text-red-300 mt-1 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                     </div>
                   )}
                </div>
                
                {creativeError && (
                  <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 backdrop-blur-md">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{creativeError}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerateCreative}
                  disabled={!creativePrompt.trim() || isGeneratingCreative}
                  className="w-full px-8 py-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-white/5 disabled:text-zinc-500 disabled:border-white/10 disabled:shadow-none border border-purple-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] transition-all duration-300 flex items-center justify-center gap-2 text-base"
                >
                  {isGeneratingCreative ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Creative
                    </>
                  )}
                </button>
              </div>
            </section>
            
            <section className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative transition-all duration-500 hover:bg-white/[0.07] hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col">
               <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center group shrink-0">
                 <h2 className="text-lg font-medium flex items-center gap-3 text-white">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold border border-purple-500/30">2</span>
                  Generated Result
                 </h2>
                 {creativeResult && (
                  <button
                    onClick={() => setCreativeResult(null)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" /> Clear
                  </button>
                )}
               </div>
               
               <div className="p-6 flex-1 flex flex-col items-center justify-center">
                  {!creativeResult ? (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-4 min-h-[300px]">
                      <ImageIcon className="w-16 h-16 opacity-50" />
                      <p className="text-center px-8">Your generated creative will appear here.</p>
                    </div>
                  ) : (
                    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <img src={creativeResult} alt="Generated Creative" className="w-full h-auto rounded-xl border border-white/10 shadow-2xl max-h-[500px] object-contain bg-black/40" />
                      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                        <button 
                          onClick={handleCreativeDownload}
                          className="flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 w-full sm:w-auto"
                        >
                          <Download className="w-5 h-5" /> Download
                        </button>
                        <button 
                          onClick={handleSendToMockup}
                          className="flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-blue-600 border border-blue-500 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:bg-blue-500 transition-all duration-300 w-full sm:w-auto"
                        >
                          Use in Mockup Generator
                        </button>
                      </div>
                    </div>
                  )}
               </div>
            </section>
          </div>
        </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
