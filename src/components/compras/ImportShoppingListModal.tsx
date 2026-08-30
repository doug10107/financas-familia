'use client';

import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { BenefitCard } from '@/hooks/useBenefitCards';
import { ShoppingList, ShoppingItem } from '@/hooks/useShoppingLists';

interface ExtractedAIItem {
  tempId: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  originalPrice?: number;
  category: string;
  selected: boolean;
}

interface ImportShoppingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: BenefitCard[];
  lists: ShoppingList[];
  activeListId: string | null;
  onImportToExistingList: (listId: string, items: Omit<ShoppingItem, 'id' | 'isChecked'>[]) => Promise<any>;
  onCreateNewListWithItems: (title: string, description: string, benefitCardId?: string, items?: Omit<ShoppingItem, 'id' | 'isChecked'>[]) => Promise<any>;
}

const UNIT_OPTIONS = [
  { value: 'un', label: 'un (unidade)' },
  { value: 'kg', label: 'kg (quilo)' },
  { value: 'g', label: 'g (gramas)' },
  { value: 'L', label: 'L (litros)' },
  { value: 'ml', label: 'ml (mililitros)' },
  { value: 'pct', label: 'pct (pacote)' },
  { value: 'cx', label: 'cx (caixa)' },
  { value: 'dz', label: 'dz (dúzia)' }
];

export function ImportShoppingListModal({
  isOpen,
  onClose,
  cards,
  lists,
  activeListId,
  onImportToExistingList,
  onCreateNewListWithItems
}: ImportShoppingListModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'qrcode' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  
  // Camera scanning state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review step state
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [extractedItems, setExtractedItems] = useState<ExtractedAIItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isDiscountApplied, setIsDiscountApplied] = useState<boolean>(false);
  const [detectedGrossTotal, setDetectedGrossTotal] = useState<number>(0);

  // Destination options
  const [destinationMode, setDestinationMode] = useState<'new' | 'existing'>('new');
  const [newListTitle, setNewListTitle] = useState('Compras de Mercado');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCardId, setNewListCardId] = useState(cards[0]?.id || '');
  const [targetExistingListId, setTargetExistingListId] = useState(activeListId || lists[0]?.id || '');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const resetState = () => {
    stopCamera();
    setFile(null);
    setFilePreview(null);
    setRawText('');
    setQrUrl('');
    setIsProcessing(false);
    setErrorMessage(null);
    setStep('input');
    setExtractedItems([]);
    setDiscountAmount(0);
    setIsDiscountApplied(false);
    setDetectedGrossTotal(0);
    setDestinationMode(lists.length > 0 ? 'existing' : 'new');
    setNewListTitle('Compras de Mercado');
    setNewListDesc('');
    if (cards.length > 0) setNewListCardId(cards[0].id);
    if (activeListId) setTargetExistingListId(activeListId);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setErrorMessage(null);

      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFilePreview(event.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }
    }
  };

  // QR Code Camera Scanner
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err);
      setIsCameraActive(false);
      setErrorMessage('Não foi possível acessar a câmera. Verifique as permissões no seu navegador.');
    }
  };

  const scanVideoFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          setQrUrl(code.data);
          stopCamera();
          return;
        }
      }
    }

    if (streamRef.current) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
  };

  const handleQrPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code && code.data) {
              setQrUrl(code.data);
              setErrorMessage(null);
            } else {
              // If QR library can't decode it directly, we can still send the file to AI
              setFile(selectedFile);
              setActiveTab('upload');
              setErrorMessage('QR Code não detectado na imagem. O arquivo foi anexado na aba "Foto ou PDF" para leitura via IA.');
            }
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleProcessAI = async () => {
    setErrorMessage(null);

    if (activeTab === 'upload' && !file) {
      setErrorMessage('Por favor, selecione uma foto, imagem ou arquivo PDF da lista.');
      return;
    }

    if (activeTab === 'qrcode' && !qrUrl.trim()) {
      setErrorMessage('Por favor, escaneie o QR Code com a câmera ou cole o link/chave da NFC-e.');
      return;
    }

    if (activeTab === 'text' && !rawText.trim()) {
      setErrorMessage('Por favor, digite ou cole o texto da lista de compras.');
      return;
    }

    setIsProcessing(true);

    try {
      let response: Response;

      if (activeTab === 'upload' && file) {
        const formData = new FormData();
        formData.append('file', file);

        response = await fetch('/api/ai/scan-list', {
          method: 'POST',
          body: formData
        });
      } else if (activeTab === 'qrcode' && qrUrl) {
        response = await fetch('/api/ai/scan-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrUrl: qrUrl.trim() })
        });
      } else {
        response = await fetch('/api/ai/scan-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText })
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar a lista com IA.');
      }

      if (!data.items || data.items.length === 0) {
        throw new Error('Nenhum item foi identificado. Tente novamente com uma foto mais nítida ou o link da NFC-e.');
      }

      const formatted: ExtractedAIItem[] = data.items.map((item: any, idx: number) => {
        const unitPrice = Number(item.estimatedPrice) >= 0 ? Number(item.estimatedPrice) : 0;
        return {
          tempId: `item-${Date.now()}-${idx}`,
          name: item.name || `Produto ${idx + 1}`,
          quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          unit: item.unit || 'un',
          estimatedPrice: unitPrice,
          originalPrice: unitPrice,
          category: item.category || 'Alimentação',
          selected: true
        };
      });

      const detectedDiscount = Number(data.discount) || 0;
      const detectedGross = Number(data.totalGross) || formatted.reduce((acc, i) => acc + (i.quantity * i.estimatedPrice), 0);

      setExtractedItems(formatted);
      setDiscountAmount(detectedDiscount);
      setDetectedGrossTotal(detectedGross);
      setIsDiscountApplied(false);
      setStep('review');
    } catch (err: any) {
      console.error('Erro na extração IA:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao comunicar com a IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemFieldChange = (tempId: string, field: keyof ExtractedAIItem, value: any) => {
    setExtractedItems(prev =>
      prev.map(i => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  };

  const handleToggleSelectItem = (tempId: string) => {
    setExtractedItems(prev =>
      prev.map(i => (i.tempId === tempId ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = extractedItems.every(i => i.selected);
    setExtractedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
  };

  const handleDeleteItem = (tempId: string) => {
    setExtractedItems(prev => prev.filter(i => i.tempId !== tempId));
  };

  // Apply or Revert Proportional Discount to Items
  const handleToggleApplyDiscount = () => {
    const currentGross = extractedItems
      .filter(i => i.selected)
      .reduce((acc, i) => acc + (i.quantity * (i.originalPrice || i.estimatedPrice)), 0);

    if (currentGross <= 0 || discountAmount <= 0) return;

    if (!isDiscountApplied) {
      // Apply discount proportionately: factor = (gross - discount) / gross
      const factor = Math.max(0, currentGross - discountAmount) / currentGross;
      setExtractedItems(prev =>
        prev.map(item => {
          const base = item.originalPrice !== undefined ? item.originalPrice : item.estimatedPrice;
          const discountedPrice = Number((base * factor).toFixed(2));
          return {
            ...item,
            originalPrice: base,
            estimatedPrice: discountedPrice
          };
        })
      );
      setIsDiscountApplied(true);
    } else {
      // Revert back to original prices
      setExtractedItems(prev =>
        prev.map(item => ({
          ...item,
          estimatedPrice: item.originalPrice !== undefined ? item.originalPrice : item.estimatedPrice
        }))
      );
      setIsDiscountApplied(false);
    }
  };

  const handleSaveToShoppingList = async () => {
    const selectedItems = extractedItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      setErrorMessage('Selecione ao menos 1 item para importar.');
      return;
    }

    const payloadItems = selectedItems.map(i => ({
      name: i.name.trim(),
      quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      unit: i.unit || 'un',
      category: i.category || 'Alimentação',
      estimatedPrice: Number(i.estimatedPrice) >= 0 ? Number(i.estimatedPrice) : 0,
      actualPrice: Number(i.estimatedPrice) >= 0 ? Number(i.estimatedPrice) : 0
    }));

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (destinationMode === 'new') {
        await onCreateNewListWithItems(
          newListTitle || 'Compras de Mercado',
          newListDesc,
          newListCardId || undefined,
          payloadItems
        );
      } else {
        const targetId = targetExistingListId || (lists.length > 0 ? lists[0].id : null);
        if (!targetId) {
          throw new Error('Nenhuma lista de compras selecionada.');
        }
        await onImportToExistingList(targetId, payloadItems);
      }

      handleClose();
    } catch (err: any) {
      console.error('Erro ao salvar itens na lista:', err);
      setErrorMessage(err.message || 'Erro ao salvar itens.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const selectedCount = extractedItems.filter(i => i.selected).length;
  const currentItemsTotal = extractedItems
    .filter(i => i.selected)
    .reduce((acc, i) => acc + (i.quantity * i.estimatedPrice), 0);

  const finalNetTotal = isDiscountApplied
    ? currentItemsTotal
    : Math.max(0, currentItemsTotal - discountAmount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'input' ? 'Importar Lista com Inteligência Artificial' : 'Conferir Itens Extraídos pela IA'}
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <Icon name="error" size="sm" className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* STEP 1: INPUT METHOD (PHOTO / QR CODE / TEXT) */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Tab navigation */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setActiveTab('upload');
                }}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="photo_camera" size="sm" /> Foto ou PDF
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('qrcode');
                }}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'qrcode'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="qr_code_scanner" size="sm" /> QR Code Cupom
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setActiveTab('text');
                }}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="notes" size="sm" /> Colar Texto
              </button>
            </div>

            {/* TAB 1: UPLOAD PHOTO / PDF */}
            {activeTab === 'upload' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-800/30 group"
                >
                  {file ? (
                    <div className="space-y-3">
                      {filePreview ? (
                        <div className="relative max-h-48 mx-auto overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 inline-block shadow-sm">
                          <img
                            src={filePreview}
                            alt="Pré-visualização"
                            className="max-h-48 object-contain rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
                          <Icon name="picture_as_pdf" size="lg" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{file.name}</p>
                        <p className="text-[11px] text-gray-500">{(file.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Icon name="add_a_photo" size="md" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          Tirar Foto ou Escolher Arquivo
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Foto do cupom fiscal, lista de compras manuscrita ou PDF
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
                  <Icon name="auto_awesome" size="sm" className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                    <strong>Dica IA:</strong> Identifica quantidades (un/kg), preços unitários (Vl.Un), totais e descontos gerais do cupom automaticamente.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: QR CODE / NFC-E */}
            {activeTab === 'qrcode' && (
              <div className="space-y-3">
                <canvas ref={canvasRef} className="hidden" />
                <input
                  type="file"
                  ref={qrFileInputRef}
                  onChange={handleQrPhotoUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Live Camera Scanner */}
                {isCameraActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-64 flex items-center justify-center shadow-md">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                      />
                      <div className="absolute inset-0 border-2 border-emerald-400/80 rounded-2xl m-6 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-xl animate-pulse flex items-center justify-center">
                          <span className="text-[10px] text-white bg-black/60 px-2 py-0.5 rounded font-mono">
                            Aponte para o QR Code
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={stopCamera}
                      className="w-full text-red-500 text-xs flex items-center justify-center gap-1"
                    >
                      <Icon name="close" size="sm" /> Fechar Câmera
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="p-4 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 transition-all flex flex-col items-center justify-center text-center group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Icon name="photo_camera" size="md" />
                      </div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Escanear com a Câmera
                      </span>
                      <span className="text-[10px] text-emerald-700/70 dark:text-emerald-400 mt-0.5">
                        Leitura instantânea do QR Code impresso
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => qrFileInputRef.current?.click()}
                      className="p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex flex-col items-center justify-center text-center group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Icon name="image" size="md" />
                      </div>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Foto com QR Code
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        Carregar imagem da galeria
                      </span>
                    </button>
                  </div>
                )}

                {/* Manual Link Input */}
                <div className="space-y-1 pt-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Ou cole o link do QR Code / Chave de Acesso (NFC-e / SAT):
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Ex: https://www.nfce.fazenda.sp.gov.br/qrcode?p=... ou 44 dígitos"
                      value={qrUrl}
                      onChange={(e) => setQrUrl(e.target.value)}
                      className="text-xs font-mono pr-8"
                    />
                    {qrUrl && (
                      <button
                        type="button"
                        onClick={() => setQrUrl('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    )}
                  </div>
                  {qrUrl && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                      <Icon name="check_circle" size="sm" className="text-emerald-500" />
                      <span className="font-semibold truncate">QR Code / Link pronto para consulta</span>
                    </div>
                  )}
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2">
                  <Icon name="info" size="sm" className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    Funciona com cupons fiscais eletrônicos (NFC-e e SAT) de supermercados e restaurantes de todo o Brasil (SP, PR, MG, RJ, RS, etc).
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: TEXT INPUT */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Cole sua lista em texto:
                  </label>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Exemplo:&#10;MARG DORIANA 1KG Qtde: 1 Vl. Unit: 12,98 Vl. Total: 12,98&#10;BANANA CATURRA kg Qtde: 1,8 Vl. Unit: 5,97 Vl. Total: 10,75&#10;Qtd. total de itens: 51&#10;Valor total R$: 624,39&#10;Descontos R$: 7,20&#10;Valor a pagar R$: 617,19"
                    className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Pode colar mensagens do WhatsApp, anotações rápidas ou o texto copiado de cupons fiscais.
                </p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleProcessAI}
                disabled={isProcessing}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando com IA...
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" size="sm" /> Analisar & Extrair Itens
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & EDIT EXTRACTED ITEMS */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Header / Summary Bar */}
            <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Icon name="select_all" size="sm" />
                    {selectedCount === extractedItems.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                  <Badge color="blue" className="text-[11px]">
                    {selectedCount} de {extractedItems.length} selecionados
                  </Badge>
                </div>

                <div className="text-right flex items-center gap-3">
                  {discountAmount > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 line-through block">
                        Bruto: {formatCurrency(detectedGrossTotal > 0 ? detectedGrossTotal : currentItemsTotal + discountAmount)}
                      </span>
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        Desconto: -{formatCurrency(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="text-right pl-2 border-l border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-500 uppercase block font-bold">Total a Debitar</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(finalNetTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discount Manager Banner */}
              {discountAmount > 0 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Icon name="local_offer" size="sm" className="text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Desconto no Cupom Fiscal Identificado: {formatCurrency(discountAmount)}
                      </span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        {isDiscountApplied
                          ? '✓ Desconto já rateado proporcionalmente nos preços dos itens.'
                          : 'Deseja abater este desconto nos valores unitários dos produtos?'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleApplyDiscount}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      isDiscountApplied
                        ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                        : 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {isDiscountApplied ? 'Desfazer Rateio' : 'Aplicar Desconto nos Itens'}
                  </button>
                </div>
              )}
            </div>

            {/* Items List (Editable table/cards) */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {extractedItems.map((item) => {
                const subtotal = item.quantity * item.estimatedPrice;

                return (
                  <div
                    key={item.tempId}
                    className={`p-3 rounded-xl border transition-all ${
                      item.selected
                        ? 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-sm'
                        : 'bg-gray-50/50 dark:bg-gray-900/30 border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleSelectItem(item.tempId)}
                        className="mt-2 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        {/* Name */}
                        <div className="sm:col-span-4">
                          <Input
                            placeholder="Nome do Produto"
                            value={item.name}
                            onChange={(e) => handleItemFieldChange(item.tempId, 'name', e.target.value)}
                            className="text-xs py-1.5 font-medium"
                          />
                        </div>

                        {/* Quantity & Unit (supports kg, g, un, etc) */}
                        <div className="sm:col-span-3 flex gap-1 items-center">
                          <div className="w-16">
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              placeholder="Qtd"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  item.tempId,
                                  'quantity',
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              className="text-xs py-1.5 text-center"
                            />
                          </div>
                          <div className="flex-1 min-w-[70px]">
                            <select
                              value={item.unit}
                              onChange={(e) => handleItemFieldChange(item.tempId, 'unit', e.target.value)}
                              className="w-full text-xs py-1.5 px-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                              {UNIT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Unit Price (Vl.Un) */}
                        <div className="sm:col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="R$ Unit"
                            value={item.estimatedPrice || ''}
                            onChange={(e) =>
                              handleItemFieldChange(
                                item.tempId,
                                'estimatedPrice',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="text-xs py-1.5 text-right"
                          />
                        </div>

                        {/* Line Subtotal */}
                        <div className="sm:col-span-2 text-right pr-1">
                          <span className="text-[10px] text-gray-400 block font-medium">Subtotal</span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>

                        {/* Delete */}
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.tempId)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                          >
                            <Icon name="delete" size="sm" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Destination Configuration */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                Onde deseja salvar estes itens?
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestinationMode('new')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    destinationMode === 'new'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon name="add" size="sm" /> Criar Nova Lista
                </button>

                <button
                  type="button"
                  disabled={lists.length === 0}
                  onClick={() => setDestinationMode('existing')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    destinationMode === 'existing'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon name="playlist_add" size="sm" /> Adicionar à Existente
                </button>
              </div>

              {destinationMode === 'new' ? (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                  <Input
                    label="Título da Lista"
                    placeholder="Ex: Supermercado Max Atacadista"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    required
                  />
                  <Select
                    label="Cartão de Benefício Preferencial (VA/VR)"
                    value={newListCardId}
                    onChange={(e) => setNewListCardId(e.target.value)}
                    options={[
                      { value: '', label: 'Nenhum (selecionar no caixa)' },
                      ...cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))
                    ]}
                  />
                </div>
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                  <Select
                    label="Selecione a Lista de Destino"
                    value={targetExistingListId}
                    onChange={(e) => setTargetExistingListId(e.target.value)}
                    options={lists.map(l => ({ value: l.id, label: l.title }))}
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('input')}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Icon name="arrow_back" size="sm" /> Voltar
              </Button>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveToShoppingList}
                  disabled={isProcessing || selectedCount === 0}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size="sm" /> Importar ({formatCurrency(finalNetTotal)})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

