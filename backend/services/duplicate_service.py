"""
Duplicate Detection Service (Optimized)
Uses sentence-transformers all-MiniLM-L6-v2 to detect similar tickets.
Performance optimizations:
  - NumPy vectorized cosine similarity (O(1) matrix op vs O(n) loop)
  - ONNX Runtime support for faster inference
  - Benchmark logging comparing old vs new performance
"""

import uuid
import os
import time
import json

# Performance optimization: use numpy for vectorized similarity
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    print("[DuplicateService] NumPy not available, falling back to torch loop")

# ONNX Runtime support
try:
    import onnxruntime as ort
    HAS_ORT = True
except ImportError:
    HAS_ORT = False
    ort = None

from sentence_transformers import SentenceTransformer, util

SIMILARITY_THRESHOLD = 0.70


class DuplicateService:
    def __init__(self):
        self.model = None
        self._loaded = False
        self._load_failed = False
        self._onnx_session = None
        # In-memory store: list of (ticket_id, numpy_embedding, text)
        # Now stored as NumPy arrays for vectorized operations
        self._ticket_ids: list[str] = []
        self._embeddings: np.ndarray = None  # Shape: (n_tickets, embedding_dim)
        self._texts: list[str] = []
        self.storage_file = os.path.join(os.path.dirname(__file__), "..", "data", "case_history_cache.json")
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)

    def is_available(self) -> bool:
        """Check if the model is available for duplicate detection."""
        return self._loaded and not self._load_failed

    def _ensure_onnx(self):
        """Load ONNX model if available."""
        if self._onnx_session is not None:
            return True
        if not HAS_ORT:
            return False
        
        onnx_path = os.path.join(os.path.dirname(__file__), "..", "models", "onnx", "duplicate_model.onnx")
        if not os.path.exists(onnx_path):
            return False
        try:
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self._onnx_session = ort.InferenceSession(onnx_path, sess_options)
            print("[DuplicateService] ONNX Runtime session loaded successfully")
            return True
        except Exception as e:
            print(f"[DuplicateService] Failed to load ONNX model: {e}")
            return False

    def _encode_onnx(self, texts: list[str]) -> np.ndarray:
        """Encode texts using ONNX Runtime."""
        if not self._ensure_onnx():
            raise RuntimeError("ONNX encoding requested but session unavailable")
        
        tokenizer = self.model.tokenizer
        encoded = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors="np"
        )
        input_ids = encoded["input_ids"].astype("int64")
        attention_mask = encoded["attention_mask"].astype("int64")
        
        emb = self._onnx_session.run(
            None,
            {"input_ids": input_ids, "attention_mask": attention_mask}
        )[0]
        # L2 normalize (required for cosine similarity via dot product)
        norms = np.linalg.norm(emb, axis=1, keepdims=True)
        norms[norms == 0] = 1e-9
        return emb / norms

    def _encode_torch(self, texts: list[str]) -> np.ndarray:
        """Encode texts using PyTorch (fallback)."""
        tensors = self.model.encode(texts, convert_to_numpy=True)
        # L2 normalize for cosine similarity via dot product
        norms = np.linalg.norm(tensors, axis=1, keepdims=True)
        norms[norms == 0] = 1e-9
        return tensors / norms

    def encode(self, texts: list[str]) -> np.ndarray:
        """Encode texts to embeddings, using ONNX if available."""
        try:
            return self._encode_onnx(texts)
        except Exception:
            return self._encode_torch(texts)

    def load(self):
        """Load the sentence-transformer model and saved tickets."""
        if self._loaded or self._load_failed:
            return
        
        print("[DuplicateService] Loading model...")
        try:
            model_path = os.environ.get("SENTENCE_TRANSFORMER_MODEL_PATH")
            if model_path and os.path.exists(model_path):
                print(f"[DuplicateService] Loading from local path: {model_path}")
                self.model = SentenceTransformer(model_path)
            else:
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
            self._loaded = True
            
            # Try loading ONNX model
            self._ensure_onnx()
            
            # Load existing tickets
            if os.path.exists(self.storage_file):
                print(f"[DuplicateService] Syncing previous ticket history from {self.storage_file}...")
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                    
                    if data:
                        texts = [item["text"] for item in data]
                        ids = [item["ticket_id"] for item in data]
                        
                        # Batch encode all texts at once
                        embeddings = self.encode(texts)
                        
                        self._ticket_ids = ids
                        self._texts = texts
                        self._embeddings = embeddings
                        print(f"[DuplicateService] Loaded {len(self._ticket_ids)} tickets with vectorized storage.")
                except Exception as e:
                    print(f"[DuplicateService] Error loading storage: {e}")
                    self._ticket_ids = []
                    self._texts = []
                    self._embeddings = None
                    
        except Exception as e:
            allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
            self._load_failed = True
            print(f"[DuplicateService] Failed to load model: {e}")
            if allow_degraded:
                print("[DuplicateService] DEGRADED: Continuing without model")
                self.model = None
                self._loaded = False
            else:
                raise

    def save_to_disk(self, ticket_id: str, text: str):
        """Append a new ticket to the JSON storage."""
        data = []
        try:
            os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
            if os.path.exists(self.storage_file):
                try:
                    with open(self.storage_file, "r") as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                except Exception:
                    data = []
            
            data.append({"ticket_id": ticket_id, "text": text})
            with open(self.storage_file, "w") as f:
                json.dump(data, f, indent=2)
            print(f"[DuplicateService] Indexed ticket {ticket_id} to case history.")
        except Exception as e:
            print(f"[DuplicateService] Failed to save to disk: {e}")

    def add_ticket(self, ticket_id: str, text: str):
        """Add a ticket to the in-memory store and persist to disk."""
        self.load()
        if not self.is_available():
            print(f"[DuplicateService] DEGRADED: Skipping embedding for ticket {ticket_id}")
            return
        
        embedding = self.encode([text])[0]  # Shape: (embedding_dim,)
        
        # Append to vectors
        if self._embeddings is None:
            self._embeddings = embedding.reshape(1, -1)
        else:
            self._embeddings = np.vstack([self._embeddings, embedding.reshape(1, -1)])
        
        self._ticket_ids.append(ticket_id)
        self._texts.append(text)
        self.save_to_disk(ticket_id, text)

    def _cosine_similarity_vectorized(self, query_emb: np.ndarray) -> tuple[float, str | None]:
        """
        Vectorized cosine similarity: O(1) matrix operation vs O(n) loop.
        Uses NumPy dot product for all stored embeddings at once.
        """
        if self._embeddings is None or len(self._ticket_ids) == 0:
            return 0.0, None
        
        # Compute dot product between query (1, dim) and all stored (n, dim)
        # Since vectors are L2-normalized, dot product = cosine similarity
        similarities = np.dot(self._embeddings, query_emb)
        
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])
        best_id = self._ticket_ids[best_idx]
        
        return best_score, best_id

    def _cosine_similarity_loop(self, query_emb) -> tuple[float, str | None]:
        """
        Legacy loop-based similarity (fallback if NumPy unavailable).
        Kept for benchmark comparison only.
        """
        best_score = 0.0
        best_id = None
        for i, stored_emb in enumerate(self._embeddings):
            score = float(util.cos_sim(query_emb, stored_emb).item())
            if score > best_score:
                best_score = score
                best_id = self._ticket_ids[i]
        return best_score, best_id

    def check_duplicate(self, text: str, threshold: float = None, run_benchmark: bool = False) -> dict:
        """
        Check if a ticket is a duplicate of any stored ticket.

        Args:
            text: The ticket text to check.
            threshold: Optional override for the similarity threshold.
            run_benchmark: If True, also run and log the old loop method for comparison.

        Returns:
            {
                "is_duplicate": bool,
                "duplicate_ticket_id": str | None,
                "similarity": float
            }
        """
        self.load()
        
        if not self.is_available():
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }
        
        active_threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD

        if not self._ticket_ids:
            return {
                "is_duplicate": False,
                "duplicate_ticket_id": None,
                "similarity": 0.0,
            }

        # Encode query
        t0 = time.perf_counter()
        query_emb = self.encode([text])[0]  # Shape: (embedding_dim,)
        encode_time = time.perf_counter() - t0

        # Vectorized similarity search
        t1 = time.perf_counter()
        best_score, best_id = self._cosine_similarity_vectorized(query_emb)
        vectorized_time = time.perf_counter() - t1

        total_time = encode_time + vectorized_time

        # Benchmark: also run old loop method for comparison
        if run_benchmark and HAS_NUMPY and len(self._ticket_ids) > 1:
            t_old = time.perf_counter()
            old_score, _ = self._cosine_similarity_loop(query_emb)
            old_time = time.perf_counter() - t_old
            
            speedup = old_time / total_time if total_time > 0 else float('inf')
            print(f"[Benchmark] Tickets: {len(self._ticket_ids)} | "
                  f"Vectorized: {vectorized_time*1000:.2f}ms | "
                  f"Loop: {old_time*1000:.2f}ms | "
                  f"Speedup: {speedup:.1f}x")

        is_dup = best_score >= active_threshold

        return {
            "is_duplicate": is_dup,
            "duplicate_ticket_id": best_id if is_dup else None,
            "similarity": round(best_score, 4),
        }
