#!/usr/bin/env python
"""Run realistic tests and print results."""

import sys
import unittest

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName("AutoGrader.test_realistic")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
