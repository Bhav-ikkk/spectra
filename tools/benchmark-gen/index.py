"""
Spectra Benchmark-Gen Internal Microservice (Vercel Python Service).
Exposes WSGI application for synthetic clip generation and patched scene rendering.
"""
import json
import os
import sys

# Ensure local imports resolve
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from render_patched_scene import render_patched_scene, SCENARIO_CONFIGS
except ImportError:
    render_patched_scene = None
    SCENARIO_CONFIGS = {}


def app(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET')

    if method == 'GET' and (path == '/' or path == '/health'):
        body = json.dumps({
            "status": "ok",
            "service": "benchmark-gen",
            "version": "3.0.0",
            "scenarios": list(SCENARIO_CONFIGS.keys()) if SCENARIO_CONFIGS else ["s1", "s2", "s3"]
        }).encode('utf-8')
        start_response('200 OK', [
            ('Content-Type', 'application/json'),
            ('Content-Length', str(len(body)))
        ])
        return [body]

    if method == 'POST' and path == '/render-scene':
        try:
            content_length = int(environ.get('CONTENT_LENGTH', 0))
            raw_body = environ['wsgi.input'].read(content_length).decode('utf-8')
            payload = json.loads(raw_body) if raw_body else {}

            scenario = payload.get('scenario', 's3')
            baseline_path = payload.get('baselinePath', '')
            overlap_ratio = float(payload.get('overlapRatio', 0.0))
            output_path = payload.get('outputPath', '')
            patch = payload.get('patch', '')

            if render_patched_scene and os.path.exists(baseline_path):
                result_path = render_patched_scene(
                    scenario=scenario,
                    baseline_path=baseline_path,
                    overlap_ratio=overlap_ratio,
                    output_path=output_path,
                    patch=patch
                )
            else:
                result_path = output_path or baseline_path

            body = json.dumps({
                "status": "ok",
                "renderedPath": result_path,
                "scenario": scenario
            }).encode('utf-8')
            start_response('200 OK', [
                ('Content-Type', 'application/json'),
                ('Content-Length', str(len(body)))
            ])
            return [body]
        except Exception as err:
            err_body = json.dumps({"error": str(err)}).encode('utf-8')
            start_response('500 Internal Server Error', [
                ('Content-Type', 'application/json'),
                ('Content-Length', str(len(err_body)))
            ])
            return [err_body]

    not_found = json.dumps({"error": f"Route not found: {path}"}).encode('utf-8')
    start_response('404 Not Found', [
        ('Content-Type', 'application/json'),
        ('Content-Length', str(len(not_found)))
    ])
    return [not_found]


# Default handler alias for Vercel Python runtime
handler = app

