import argparse
from dotenv import load_dotenv
load_dotenv()

from src.pipelines import (
    run_create_collections,
    run_location_pipeline,
    run_image_pipeline,
    run_text_pipeline,
    run_full_pipeline,
)


def main():
    parser = argparse.ArgumentParser(
        description="Tourism embedding pipeline: S3 -> RAM -> Models -> Qdrant"
    )

    parser.add_argument(
        "--task",
        required=True,
        choices=[
            "create-collections",
            "locations",
            "images",
            "docs",
            "full",
        ],
        help="Chọn pipeline cần chạy.",
    )

    args = parser.parse_args()

    if args.task == "create-collections":
        run_create_collections()

    elif args.task == "locations":
        run_location_pipeline()

    elif args.task == "images":
        run_image_pipeline()

    elif args.task == "docs":
        run_text_pipeline()

    elif args.task == "full":
        run_full_pipeline()


if __name__ == "__main__":
    main()
