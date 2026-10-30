# -*- coding: utf-8 -*-
"""
M-10 · Revisión anti-fuga / anti-síntesis

Este descargador fue NEUTRALIZADO. Motivo:

En la revisión del pipeline de ML se descubrió que el dato que alimentaba el
entrenamiento NO era el dataset real de SisFall: la función
``generate_curated_sisfall_benchmark()`` (ELIMINADA) generaba señales
sintéticas (senos + ruido, caídas con pico exponencial) y el resto del
proyecto las etiquetaba como si fueran el dataset de la Universidad de
Antioquia, produciendo métricas irreales (100 % de exactitud).

Regla actual del proyecto:
  - El pipeline (``preprocess_sisfall.py``) exige el dataset REAL de SisFall
    en ``ml_training/data/SisFall_dataset/`` con las carpetas
    SA01..SA23 / SE01..SE15.
  - Si el dataset real no está presente, el pipeline FALLA con un error
    claro. No hay descarga automática y NO EXISTE fallback sintético.

Fuente oficial del dataset:
  Sucerquia, A.; López, J.D.; Vargas-Bonilla, J.F ``SisFall: A Fall and
  Movement Dataset``, Sensors 2017, 17(1), 198. Universidad de Antioquia,
  SISTEMIC. Zenodo DOI: 10.5281/zenodo.4644999 (SisFall_dataset.zip).
"""
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
DATASET_ROOT = DATA_DIR / "SisFall_dataset"


def main() -> None:
    print("\n" + "=" * 70)
    print("[SisFall] ESTE DESCARGADOR ESTÁ DESHABILITADO (revisión anti-fuga).")
    print("=" * 70)
    print(f"El pipeline exige el dataset REAL de SisFall en:\n    {DATASET_ROOT}")
    print("\nDescárgalo manualmente de la fuente oficial (UDEA/SISTEMIC, Zenodo DOI")
    print("10.5281/zenodo.4644999) y descomprímelo en esa ruta, con las carpetas")
    print("SA01..SA23 y SE01..SE15.")
    print("\nNo se descarga nada de espejos dudosos y NO se generan datos sintéticos.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
