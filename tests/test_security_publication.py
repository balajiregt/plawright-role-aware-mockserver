import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
MODULE_DIR = ROOT / 'benchmarks/dashboard'
sys.path.insert(0, str(MODULE_DIR))
spec = importlib.util.spec_from_file_location('security_publication', MODULE_DIR / 'publish.py')
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


class PublicationBoundaryTests(unittest.TestCase):
    def test_prepared_aggregate_is_revalidated_before_write_token_path(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            here = root / 'benchmarks/dashboard'
            here.mkdir(parents=True)
            project = json.loads((MODULE_DIR / 'config.json').read_text())['project']
            (here / 'config.json').write_text(json.dumps({'project':project}))
            (here / 'public-vocabulary.json').write_text((MODULE_DIR / 'public-vocabulary.json').read_text())
            prepared = root / 'aggregate.json'
            valid = {'project':project, 'runId':'a'*16, 'status':'passed'}
            with patch.object(publication, 'HERE', here), patch.object(publication, 'publish') as publish, \
                    patch.dict(os.environ, {'BENCHMARK_PUBLISH':'0'}), patch.object(sys, 'argv', ['publish.py','--prepared',str(prepared)]):
                prepared.write_text(json.dumps(valid))
                with contextlib.redirect_stdout(io.StringIO()):
                    publication.main()
                self.assertEqual(json.loads((root / 'benchmark-results/dashboard-pending.json').read_text()), valid)
                for invalid in [dict(valid, sourceCode='dummy private code'), dict(valid, project='other'), dict(valid, runId='option-like-input')]:
                    prepared.write_text(json.dumps(invalid))
                    with self.assertRaises(ValueError):
                        publication.main()
                publish.assert_not_called()


if __name__ == '__main__':
    unittest.main()
