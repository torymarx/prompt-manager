import { useState, useEffect } from 'react'
// @ts-ignore
import smartcrop from 'smartcrop'

/**
 * 이미지 내 주요 피사체(얼굴 등)를 분석하여 object-position 값을 반환하는 훅
 */
export function useSmartCrop(src: string | any | undefined) {
    const [objectPosition, setObjectPosition] = useState<string>('center center')

    useEffect(() => {
        if (typeof src !== 'string' || !src) {
            setObjectPosition('center center')
            return
        }

        let isMounted = true
        const img = new Image()

        // CORS 정책 대응. 이 설정이 없으면 캔버스 분석이 불가능합니다.
        // 단, 서버(Supabase 등)에서 CORS 헤더를 보내주지 않으면 이미지 로드 자체가 실패할 수 있습니다.
        img.crossOrigin = 'Anonymous'

        // 쿼리 스트링을 추가하여 브라우저 캐시로 인한 CORS 에러 우회 시도
        // smartcrop은 내부적으로 캔버스에 이미지를 그리므로, 캐시된 이미지로 인해 CORS 에러가 발생할 수 있습니다.
        // 이 방법은 일부 경우에만 유효하며, 근본적인 CORS 문제는 서버 설정으로 해결해야 합니다.
        const proxySrc = src.includes('?') ? `${src}&t=${Date.now()}` : `${src}?t=${Date.now()}`
        img.src = src // 일단 원본으로 시도

        img.onload = async () => {
            try {
                // 이미지의 실제 가로세로비를 고려하여 분석 (주로 16:9 또는 1:1)
                const aspect = img.width / img.height
                const result = await smartcrop.crop(img, {
                    width: aspect > 1 ? 100 : 100 * aspect,
                    height: aspect > 1 ? 100 / aspect : 100,
                    minScale: 1.0,
                    ruleOfThirds: true // 삼분할법 적용하여 더 자연스러운 구도 탐색
                })

                if (isMounted && result && result.topCrop) {
                    const crop = result.topCrop
                    // 피사체의 정중앙 좌표 백분율 계산 및 0-100% 범위로 제한
                    const centerX = Math.max(0, Math.min(100, ((crop.x + crop.width / 2) / img.width) * 100))
                    const centerY = Math.max(0, Math.min(100, ((crop.y + crop.height / 2) / img.height) * 100))

                    setObjectPosition(`${centerX.toFixed(2)}% ${centerY.toFixed(2)}%`)
                }
            } catch (error) {
                // 캔버스 분석 실패 시 (대부분 CORS 문제) 기본값 유지
                // console.error('SmartCrop analysis failed:', error) // 디버깅 필요 시 주석 해제
                if (isMounted) setObjectPosition('center center')
            }
        }

        img.onerror = () => {
            // CORS 에러 등으로 분석용 이미지 로드 실패 시 원본 이미지는 보여야 하므로 기본값 유지
            if (isMounted) setObjectPosition('center center')
        }

        return () => {
            isMounted = false
        }
    }, [src])

    return objectPosition
}
